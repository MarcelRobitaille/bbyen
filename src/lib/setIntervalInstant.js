const setIntervalInstant = (fn, timer, kickoff, ...args) => {
	if (kickoff) fn(...args)

	return setInterval(fn, timer, ...args)
}

module.exports = setIntervalInstant
