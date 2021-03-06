"use strict";

const { Sequelize } = require('sequelize');
const logger = require('./logger').child({id: 'Sequelize'})

/**
 * Default Sequelize + SQLite db
 */
const database = new Sequelize({
    dialect: 'sqlite',
    storage: '.local.sqlite',
    logging: msg => logger.trace(msg)
});

module.exports = database;
