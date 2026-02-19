const RecycleBin = require('../models/RecycleBin');
const { createController } = require('./baseController');
module.exports = createController(RecycleBin);
