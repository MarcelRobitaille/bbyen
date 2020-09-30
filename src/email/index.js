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

	return { transporter, emailTemplate }
}

module.exports = { init }
