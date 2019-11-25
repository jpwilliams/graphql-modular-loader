const { resolve, dirname } = require('path')

const gql = require('graphql-tag')
const { microload } = require('@jpwilliams/microload')
const callsites = require('callsites')

const commonResolvers = ['Query', 'Mutation', 'Subscription']
const typesToAddMap = {}

const startingState = {
	typeDefs: [],
	resolvers: {},
	loaders: {}
}

function getLoaders (loaders, context) {
	return Object.keys(loaders).reduce((map, key) => {
		map[key] = loaders[key](context)

		return map
	}, {})
}

function loader (path) {
	if (!path || !path.length) throw new Error('A path to load must be specified.')

	const cwd = dirname(callsites()[1].getFileName())
	const normalisedPath = resolve(cwd, path)

	const types = microload(normalisedPath, {
		extensions: ['js', 'graphql']
	})

	let {
		typeDefs,
		resolvers,
		loaders
	} = Object.keys(types).reduce((exp, typeKey) => {
		const {
			schema,
			resolvers,
			loaders
		} = types[typeKey]
	
		if (schema) {
			exp.typeDefs.push(gql(schema))
		}
	
		if (resolvers) {
			// initialise
			exp.resolvers[typeKey] = exp.resolvers[typeKey] || {}
	
			// add nice debugging names
			Object.keys(resolvers).forEach((resolverKey) => {
				if (typeof resolvers[resolverKey] === 'function') {
					Object.defineProperty(resolvers[resolverKey], 'name', {
						value: `Resolver_${typeKey}_${resolverKey}`
					})
				}
			})
	
			Object.assign(exp.resolvers[typeKey], resolvers)
		}
	
		if (loaders) {
			Object.assign(exp.loaders, loaders)
		}
	
		commonResolvers.forEach((item) => {
			const target = types[typeKey][item]
			if (!target) return
	
			const keys = Object.keys(target)
	
			keys.forEach((key) => {
				// ignore types that don't have the minimum requirements
				if (!target[key].schema && !target[key].resolver) return
	
				typesToAddMap[item] = true
	
				if (target[key].schema) {
					let targetSchema = target[key].schema.trim()
	
					if (!targetSchema.startsWith('extend')) {
						targetSchema = 'extend ' + targetSchema
					}
	
					exp.typeDefs.push(gql(targetSchema))
				}
	
				if (target[key].resolver) {
					Object.defineProperty(target[key].resolver, 'name', {
						value: `${item}_${typeKey}_${key}`
					})
	
					exp.resolvers[item] = exp.resolvers[item] || {}
					exp.resolvers[item][key] = target[key].resolver
				}
			})
		})
	
		return exp
	}, startingState)
	
	let BaseTypeDefs = '\n'
	const typesToAdd = Object.keys(typesToAddMap)
	
	typesToAdd.forEach((type) => {
		BaseTypeDefs += `type ${type}\n`
	})
	
	BaseTypeDefs += 'schema {\n'
	
	typesToAdd.forEach((type) => {
		BaseTypeDefs += `  ${type.toLowerCase()}: ${type}\n`
	})
	
	BaseTypeDefs += '}\n'
	
	typeDefs.push(gql(BaseTypeDefs))

	return {
		typeDefs,
		resolvers,
		loaders,
		getLoaders: getLoaders.bind(null, loaders)
	}
}

module.exports = {
	loader
}
