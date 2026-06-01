async def stream_copilot_chat(
    user_message: str,
    history: list[dict],
    organization_id: uuid.UUID,
    db: AsyncSession,
    page_context: Optional[dict] = None,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    conversation_id: Optional[str] = None,
    approved_tool_call: Optional[dict] = None,
):
    import json
    
    client = Groq(api_key=settings.groq_api_key)
    oid_str = str(organization_id)
    uid_str = str(user_id)

    def sse(event_type: str, data: dict):
        d = {"type": event_type}
        d.update(data)
        return json.dumps(d) + "\n\n"

    # 1. Handle Approval Execution
    if approved_tool_call:
        name = approved_tool_call.get("name")
        args = approved_tool_call.get("args", {})
        result_text = await execute_write_tool(name, args, oid_str, uid_str, db)
        conversation_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, result_text)
        yield sse("meta", {"conversation_id": conversation_id})
        yield sse("chunk", {"content": result_text})
        yield sse("done", {})
        return

    # 2. Build Messages
    timezone_str = "Asia/Kolkata"
    try:
        org_res = await db.execute(
            text("SELECT timezone FROM organizations WHERE id = :oid"),
            {"oid": organization_id}
        )
        org_row = org_res.fetchone()
        if org_row and org_row[0]:
            timezone_str = org_row[0]
    except Exception as e:
        logger.error(f"Error fetching org timezone: {e}")

    try:
        tz = zoneinfo.ZoneInfo(timezone_str)
        local_dt = datetime.now(tz)
    except Exception:
        local_dt = datetime.now()

    curr_time = local_dt.strftime("%A, %b %d, %Y %I:%M %p")
    sys_prompt = f"{COPILOT_SYSTEM_PROMPT}\n\nCURRENT_TIME: {curr_time}\n(Note: Always convert relative dates like 'tomorrow' or 'next week' into YYYY-MM-DD format based on CURRENT_TIME when calling tools.)"
    
    messages = [{"role": "system", "content": sys_prompt}]
    for h in history[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})
    
    prompt = user_message
    if page_context and page_context.get("candidate_id"):
        c_name = page_context.get("candidate_name", "Unknown")
        c_id = page_context.get("candidate_id")
        prompt = f"[Viewing Candidate: {c_name} ({c_id})]\n\n{user_message}"
    messages.append({"role": "user", "content": prompt})

    try:
        stream_resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            stream=True
        )
        
        is_tool_call = False
        tool_call_name = ""
        tool_call_args = ""
        tool_call_id = ""
        full_text = ""
        
        yield sse("meta", {"conversation_id": conversation_id})
        
        for chunk in stream_resp:
            delta = chunk.choices[0].delta
            
            if delta.tool_calls:
                is_tool_call = True
                tc = delta.tool_calls[0]
                if tc.id: tool_call_id = tc.id
                if tc.function.name: tool_call_name += tc.function.name
                if tc.function.arguments: tool_call_args += tc.function.arguments
            elif not is_tool_call and delta.content:
                full_text += delta.content
                yield sse("chunk", {"content": delta.content})

        if is_tool_call:
            try: args = json.loads(tool_call_args)
            except: args = {}
            args = resolve_tool_args_context(tool_call_name, args, page_context)
            
            if tool_call_name in ["search_candidates", "search_jobs", "search_users", "get_pipeline_summary"]:
                result = await execute_read_tool(tool_call_name, args, oid_str, db)
                
                messages.append({
                    "role": "assistant", 
                    "tool_calls": [{"id": tool_call_id, "type": "function", "function": {"name": tool_call_name, "arguments": tool_call_args}}]
                })
                messages.append({"role": "tool", "tool_call_id": tool_call_id, "name": tool_call_name, "content": result})
                
                second_resp = client.chat.completions.create(model=GROQ_MODEL, messages=messages, stream=True)
                for chunk in second_resp:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        full_text += delta.content
                        yield sse("chunk", {"content": delta.content})
            else:
                c_name = str(args.get("candidate_name", "")).lower().strip("[]() ")
                if tool_call_name in ["schedule_meeting", "update_candidate_stage"] and (not c_name or c_name in ["unknown", "a candidate", "candidate", "placeholder", "the candidate", "candidate_name"]):
                    reply = "Please specify the exact name or email of the candidate you want to perform this action for."
                    conversation_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, reply)
                    yield sse("meta", {"conversation_id": conversation_id})
                    yield sse("chunk", {"content": reply})
                    yield sse("done", {})
                    return
                
                reply = "I've prepared an update. Please approve it to proceed."
                conversation_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, reply)
                yield sse("approval", {
                    "conversation_id": conversation_id,
                    "pending_tool_call": {"name": tool_call_name, "args": args, "id": tool_call_id},
                    "reply": reply
                })
                yield sse("done", {})
                return

        # Check hallucination fallback on full_text
        reply = full_text
        for t_name in ["update_candidate_stage", "schedule_meeting"]:
            if t_name in reply:
                json_match = re.search(r"\{.*?\}", reply, re.DOTALL)
                if json_match:
                    try:
                        args = json.loads(json_match.group(0))
                        c_name = str(args.get("candidate_name", "")).lower().strip("[]() ")
                        if t_name in ["schedule_meeting", "update_candidate_stage"] and (not c_name or c_name in ["unknown", "a candidate", "candidate", "placeholder", "the candidate", "candidate_name"]):
                            reply_text = "Please specify the exact name or email of the candidate you want to perform this action for."
                            conversation_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, reply_text)
                            yield sse("meta", {"conversation_id": conversation_id})
                            yield sse("chunk", {"content": reply_text})
                            yield sse("done", {})
                            return
                        
                        reply_text = "I've prepared an update. Please approve it to proceed."
                        conversation_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, reply_text)
                        yield sse("approval", {
                            "conversation_id": conversation_id,
                            "pending_tool_call": {"name": t_name, "args": args},
                            "reply": reply_text
                        })
                        yield sse("done", {})
                        return
                    except: pass

        conversation_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, reply)
        yield sse("meta", {"conversation_id": conversation_id})
        yield sse("done", {})

    except Exception as e:
        try: await db.rollback()
        except: pass
        
        error_msg = str(e)
        yield sse("chunk", {"content": f"Sorry, I encountered an error: {error_msg}"})
        yield sse("done", {})
