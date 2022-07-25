const deepEqual = (a, b) => {
	if ((typeof a == 'object' && a != null) &&
			(typeof b == 'object' && b != null)) {
		if (Object.keys(a).length !== Object.keys(b).length) {
			return false;
		}
		for (let key in a) {
			if(!(key in b) || !deepEqual(a[key], b[key])) {
				return false;
			}
		}
		for (let key in b) {
			if (!(key in a) || !deepEqual(b[key], a[key])) {
				return false;
			}
		}
		return true;
	} else {
		return a === b;
	}
}

module.exports = deepEqual
