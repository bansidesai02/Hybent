from typing import Any, Optional

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette import status

class APIErrorResponse(BaseModel):
    success: bool = False
    message: str
    details: Optional[dict] = None

class APISuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Any = None

class APIResponse:
    @staticmethod
    def success(
        message: str, data: Any = None, status_code: int = status.HTTP_200_OK
    ) -> JSONResponse:
        if isinstance(data, BaseModel):
            data = jsonable_encoder(data)
        elif isinstance(data, list):
            data = jsonable_encoder(data)

        response_data = APISuccessResponse(message=message, data=data)
        return JSONResponse(content=response_data.model_dump(mode="json"), status_code=status_code)

    @staticmethod
    def error(
        message: str, status_code: int = 400, details: Optional[dict[Any, Any]] = None
    ) -> JSONResponse:
        response_data = APIErrorResponse(message=message, details=details)
        return JSONResponse(content=response_data.model_dump(), status_code=status_code)
