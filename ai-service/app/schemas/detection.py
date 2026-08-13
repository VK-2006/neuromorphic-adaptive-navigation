from pydantic import BaseModel
from typing import Any
class DetectRequest(BaseModel): image:str
class Detection(BaseModel): objectClass:str; confidence:float; boundingBox:list[float]; approximateDistance:float|None=None; metadata:dict[str,Any]={}
class DetectResponse(BaseModel): detections:list[Detection]; mode:str; modelVersion:str; validated:bool=False; explainability:dict[str,Any]
