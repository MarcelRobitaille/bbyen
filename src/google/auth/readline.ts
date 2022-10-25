import process from 'process'
import readline from 'readline'

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

export default (question: string): Promise<string> => new Promise(resolve => {
	rl.question(question, answer => {
		resolve(answer)
		rl.close()
	})
})
