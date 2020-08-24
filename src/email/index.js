const fs = require('pn/fs')
const path = require('path')

const nodemailer = require('nodemailer')
const Handlebars = require('handlebars')


const init = async (config) => {
	const transporter = nodemailer.createTransport(config)
	const emailTemplate = Handlebars.compile(await fs.readFile(
		path.join(__dirname, './template.hbs'),
		'utf-8',
	))

	return { transporter, emailTemplate }
}

module.exports = { init }
