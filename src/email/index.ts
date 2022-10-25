import fs from 'fs/promises'
import path from 'path'

import ejs from 'ejs'
import nodemailer from 'nodemailer'

import { EmailConfig } from '../config'

const loadTemplate = async (name: string) =>
	ejs.compile(await fs.readFile(
		path.join(__dirname, name),
		'utf-8',
	))


export interface ISendVideoEmail {
	channelId: string,
	channelThumbnail: string,
	channelTitle: string,
	date: Date,
	isLiveStreamOrPremere: boolean,
	videoDuration: string,
	videoId: string,
	videoThumbnail: string,
	videoTitle: string,
	videoURL: string,
}

export interface ISendErrorEmail {
	stack: string,
	message: string,
}

export const init = async (config: EmailConfig) => {
	const transporter = nodemailer.createTransport(config)
	const emailTemplate = await loadTemplate('./video-template.ejs')
	const errorTemplate = await loadTemplate('./error-template.ejs')

	// Send an email about a new upload
	// Has the video thumbnail, title, length, etc.
	const sendVideoEmail = ({ channelTitle, date, ...rest }: ISendVideoEmail) =>
		transporter.sendMail({
			from: config.sendingContact,
			to: config.destination,
			subject: `${channelTitle} just uploaded a video`,
			date,
			html: emailTemplate({ channelTitle, ...rest }),
		})

	// Notify about an error with the software
	const sendErrorEmail = (error: ISendErrorEmail) =>
		transporter.sendMail({
			from: config.sendingContact,
			to: config.destination,
			subject: 'BBYEN encountered and error',
			html: errorTemplate({ error }),
		})

	return { sendVideoEmail, sendErrorEmail }
}
