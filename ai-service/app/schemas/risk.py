from pydantic import BaseModel,Field
from typing import Any
class RiskFeatures(BaseModel):
    objectClass:str='unknown'; confidence:float=Field(0,ge=0,le=1); estimatedDistance:float=Field(10,ge=0); relativeSpeed:float=0; userSpeed:float=0; objectPersistence:float=Field(0,ge=0,le=1); trafficDensity:float=Field(0,ge=0,le=1); hazardFrequency:float=Field(0,ge=0,le=1); visibility:float=Field(1,ge=0,le=1); weatherRisk:float=Field(0,ge=0,le=1); roadCondition:float=Field(0,ge=0,le=1); verifiedReports:float=Field(0,ge=0)
class RiskRequest(BaseModel): features:RiskFeatures
class BatchRiskRequest(BaseModel): items:list[RiskFeatures]
class RiskResponse(BaseModel): score:float; level:str; confidence:float; modelVersion:str; mode:str; validated:bool=False; explanation:dict[str,Any]
