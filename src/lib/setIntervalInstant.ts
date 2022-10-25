const setIntervalInstant = (
	fn: (...args: any[]) => any,
	timer: number,
	kickoff: boolean,
	...args: any[]
) => {
	if (kickoff) fn(...args)

	return setInterval(fn, timer, ...args)
}

export default setIntervalInstant
