// NAVORA_OPENWEATHER_V11_2
const weather = require('../services/weatherService');
const { ok } = require('../utils/response');

exports.status = (req, res) => ok(res, weather.status());

exports.current = async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng ?? req.query.lon);
  const data = await weather.currentAt(lat, lng);
  ok(res, data);
};
