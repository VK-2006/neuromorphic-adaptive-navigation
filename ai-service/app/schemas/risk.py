from pydantic import BaseModel,Field
from pydantic.types import PositiveFloat
from typing import Any, Optional
class RiskFeatures(BaseModel):
    objectClass:str='unknown'; confidence:float=Field(0,ge=0,le=1); estimatedDistance:float=Field(10,ge=0); relativeSpeed:float=0; userSpeed:float=0; objectPersistence:float=Field(0,ge=0,le=1); trafficDensity:float=Field(0,ge=0,le=1); hazardFrequency:float=Field(0,ge=0,le=1); visibility:float=Field(1,ge=0,le=1); weatherRisk:float=Field(0,ge=0,le=1); roadCondition:float=Field(0,ge=0,le=1); verifiedReports:float=Field(0,ge=0); distanceKm:Optional[float]=Field(None,ge=0); travelTimeMin:Optional[float]=Field(None,ge=0); trafficLevel:Optional[int]=Field(None,ge=0,le=2); potholeLevel:Optional[int]=Field(None,ge=0,le=3); roadDamageLevel:Optional[int]=Field(None,ge=0,le=3); roadBlockageLevel:Optional[int]=Field(None,ge=0,le=3); accidentRisk:Optional[float]=Field(None,ge=0,le=1); pedestrianDensity:Optional[float]=Field(None,ge=0,le=1); vehicleDensity:Optional[float]=Field(None,ge=0,le=1); roadWidth:Optional[PositiveFloat]=None; lightingCondition:Optional[int]=Field(None,ge=0,le=2); historicalRisk:Optional[float]=Field(None,ge=0,le=1)
class RiskRequest(BaseModel): features:RiskFeatures
class BatchRiskRequest(BaseModel): items:list[RiskFeatures]
class RiskResponse(BaseModel): score:float; level:str; confidence:float; modelVersion:str; mode:str; validated:bool=False; explanation:dict[str,Any]
