from pydantic import BaseModel, EmailStr

class DemoRequest(BaseModel):
    first_name: str
    last_name: str
    work_email: EmailStr
    company_name: str
    team_size: str
    monthly_hires: str
    hiring_challenge: str
