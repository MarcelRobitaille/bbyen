const process = require('process')
const readline = require('readline')

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

module.exports = question => new Promise(resolve => {
	rl.question(question, answer => {
		resolve(answer)
		rl.close()
	})
})
