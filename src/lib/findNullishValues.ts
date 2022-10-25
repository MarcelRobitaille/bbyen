/**
 * Return the keys for all nullish values in an object
 * Useful for printing when doing TypeScript narrowing
 */

const findNullishValues = (o: Object) =>
	Object.entries(o).filter(([_k, v]) => v === null).map(([k, _v]) => k)
export default findNullishValues
