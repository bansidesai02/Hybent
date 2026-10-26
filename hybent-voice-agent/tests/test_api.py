from tests.conftest import task_body


async def test_requires_key(api, make_client):
    await make_client()
    assert (await api.post("/v1/tasks", json=task_body())).status_code == 401
    assert (await api.post("/v1/tasks", json=task_body(), headers={"X-Voice-Key": "hvk_wrong"})).status_code == 401


async def test_create_is_idempotent_on_client_ref(api, make_client):
    _, key = await make_client()
    h = {"X-Voice-Key": key}
    first = await api.post("/v1/tasks", json=task_body(), headers=h)
    assert first.status_code == 201
    assert first.json()["status"] == "SCHEDULED"
    again = await api.post("/v1/tasks", json=task_body(), headers=h)
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]


async def test_validates_phone_language_and_tz(api, make_client):
    _, key = await make_client()
    h = {"X-Voice-Key": key}
    bad_phone = task_body(callee={"name": "R", "phone_e164": "98123 45678"})
    assert (await api.post("/v1/tasks", json=bad_phone, headers=h)).status_code == 422
    bad_lang = task_body(callee={"name": "R", "phone_e164": "+919812345678", "language_pref": "gu"})
    assert (await api.post("/v1/tasks", json=bad_lang, headers=h)).status_code == 422
    bad_tz = task_body(callee={"name": "R", "phone_e164": "+919812345678", "timezone": "Mars/Base"})
    assert (await api.post("/v1/tasks", json=bad_tz, headers=h)).status_code == 422


async def test_consent_is_required(api, make_client):
    _, key = await make_client()
    body = task_body()
    del body["consent"]
    assert (await api.post("/v1/tasks", json=body, headers={"X-Voice-Key": key})).status_code == 422


async def test_opted_out_number_is_refused(api, make_client):
    _, key = await make_client()
    h = {"X-Voice-Key": key}
    r = await api.post("/v1/opt-outs", json={"scope_id": "org1", "phone_e164": "+919812345678"}, headers=h)
    assert r.status_code == 204
    assert (await api.post("/v1/tasks", json=task_body(), headers=h)).status_code == 409
    # The opt-out is scoped: another tenant may still call that number.
    other = task_body(client_ref="hiring:org2:cand9:prescreen:1", scope_id="org2")
    assert (await api.post("/v1/tasks", json=other, headers=h)).status_code == 201


async def test_clients_cannot_see_each_others_tasks(api, make_client):
    _, hiring_key = await make_client("hiring")
    _, sales_key = await make_client("sales")
    task_id = (await api.post("/v1/tasks", json=task_body(), headers={"X-Voice-Key": hiring_key})).json()["id"]
    assert (await api.get(f"/v1/tasks/{task_id}", headers={"X-Voice-Key": sales_key})).status_code == 404
    assert (await api.post(f"/v1/tasks/{task_id}/cancel", headers={"X-Voice-Key": sales_key})).status_code == 404
    assert (await api.get(f"/v1/tasks/{task_id}", headers={"X-Voice-Key": hiring_key})).status_code == 200


async def test_cancel(api, make_client):
    _, key = await make_client()
    h = {"X-Voice-Key": key}
    task_id = (await api.post("/v1/tasks", json=task_body(), headers=h)).json()["id"]
    r = await api.post(f"/v1/tasks/{task_id}/cancel", headers=h)
    assert r.json()["status"] == "CANCELLED"
    assert r.json()["next_attempt_at"] is None
