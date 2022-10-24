const fs = require('pn/fs')
const path = require('path')

const ejs = require('ejs')
const nodemailer = require('nodemailer')

const loadTemplate = async name =>
	ejs.compile(await fs.readFile(
		path.join(__dirname, name),
		'utf-8',
	))


const init = async (config) => {
	const transporter = nodemailer.createTransport(config)
	const emailTemplate = await loadTemplate('./video-template.ejs')
	const errorTemplate = await loadTemplate('./error-template.ejs')

	// Send an email about a new upload
	// Has the video thumbnail, title, length, etc.
	const sendVideoEmail = ({ channelTitle, date, ...rest }) =>
		transporter.sendMail({
			from: config.email.sendingContact,
			to: config.email.destination,
			subject: `${channelTitle} just uploaded a video`,
			date,
			html: emailTemplate({ channelTitle, ...rest }),
		})

	// Notify about an error with the software
	const sendErrorEmail = error =>
		transporter.sendMail({
			from: config.email.sendingContact,
			to: config.email.destination,
			subject: 'BBYEN encountered and error',
			html: errorTemplate({ error }),
		})

	return { sendVideoEmail, sendErrorEmail }
}

module.exports = { init }
