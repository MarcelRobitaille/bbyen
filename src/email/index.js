const fs = require('pn/fs')
const path = require('path')

const ejs = require('ejs')
const nodemailer = require('nodemailer')


const init = async (config) => {
	const transporter = nodemailer.createTransport(config)
	const emailTemplate = ejs.compile(await fs.readFile(
		path.join(__dirname, './template.ejs'),
		'utf-8',
	))
	const errorTemplate = ejs.compile(await fs.readFile(
		path.join(__dirname, './error-template.ejs.ejs'),
		'utf-8',
	))

	const sendErrorEmail = error =>
		transporter.sendMail({
			from: config.email.sendingContact,
			to: config.email.destination,
			subject: 'BBYEN encountered and error',
			html: errorTemplate({ error }),
		})

	return { transporter, emailTemplate, sendErrorEmail }
}

module.exports = { init }
