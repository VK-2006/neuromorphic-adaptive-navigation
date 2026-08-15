import base64,cv2,numpy as np
from ..config import settings
def decode_data_url(value:str):
    raw=value.split(',',1)[1] if ',' in value else value
    data=base64.b64decode(raw,validate=True)
    if len(data)>settings.max_image_bytes: raise ValueError('Image exceeds size limit')
    arr=np.frombuffer(data,dtype=np.uint8); image=cv2.imdecode(arr,cv2.IMREAD_COLOR)
    if image is None: raise ValueError('Invalid image data')
    return image
