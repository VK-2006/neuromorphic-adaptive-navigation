const {
  detectionSimilarity,
  boxSimilarity,
  DETECTION_SIMILARITY_THRESHOLD,
}=require('../src/services/hazardSimilarity');

test('detection similarity merges repeated nearby camera detections',()=>{
  const previous={detection:{boundingBox:[.22,.35,.18,.16],approximateDistance:8.2,confidence:.88,detectorMode:'torchscript-trained-weights',detectorVersion:'detector-1'}};
  const current={detection:{boundingBox:[.24,.36,.17,.16],approximateDistance:8.8,confidence:.84,detectorMode:'torchscript-trained-weights',detectorVersion:'detector-1'}};
  expect(boxSimilarity(previous.detection.boundingBox,current.detection.boundingBox)).toBeGreaterThan(.75);
  expect(detectionSimilarity(previous,current)).toBeGreaterThan(DETECTION_SIMILARITY_THRESHOLD);
});

test('detection similarity separates visually and physically different detections',()=>{
  const previous={detection:{boundingBox:[.05,.10,.12,.12],approximateDistance:5,confidence:.92,detectorMode:'torchscript-trained-weights',detectorVersion:'detector-1'}};
  const current={detection:{boundingBox:[.78,.72,.10,.10],approximateDistance:34,confidence:.51,detectorMode:'opencv-development-heuristic',detectorVersion:'detector-2'}};
  expect(detectionSimilarity(previous,current)).toBeLessThan(DETECTION_SIMILARITY_THRESHOLD);
});

test('detection similarity requires per-frame detection evidence',()=>{
  expect(detectionSimilarity({source:'camera'},{source:'camera'})).toBeNull();
});
