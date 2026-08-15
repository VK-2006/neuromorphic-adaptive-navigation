// NAVORA_OPENWEATHER_V11_2
const router = require('express').Router();
const controller = require('../controllers/weatherController');
const { optional } = require('../middleware/auth');

router.get('/status', controller.status);
router.get('/current', optional, controller.current);

module.exports = router;
