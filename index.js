const { resolve, dirname } = require('path')

const gql = require('graphql-tag')
const { microload } = require('@jpwilliams/microload')
const callsites = require('callsites')
const ora = require('ora')

const commonResolvers = ['Query', 'Mutation', 'Subscription']

function getNestedFns (nestedBlocks, context) {
	return Object.keys(nestedBlocks).reduce((block, mainKey) => {
		block[mainKey] = Object.keys(nestedBlocks[mainKey]).reduce((map, key) => {
			map[key] = nestedBlocks[mainKey][key](context)

			return map
		}, {})

		return block
	}, {})
}

function loader (path) {
	if (!path || !path.length) throw new Error('A path to load must be specified.')

	const cwd = dirname(callsites()[1].getFileName())
	const normalisedPath = resolve(cwd, path)

	const types = microload(normalisedPath, {
		extensions: ['js', 'graphql']
	})

	const typesToAddMap = {}

	let {
		typeDefs,
		resolvers,
		loaders,
		middleware
	} = Object.keys(types).reduce((exp, typeKey) => {
		const {
			schema,
			resolvers,
			loaders,
			middleware
		} = types[typeKey]

		const spinner = ora(`Loading ${typeKey}...`).start()
	
		if (schema) {
			spinner.text = `Loading ${typeKey} schema...`

			exp.typeDefs.push(gql(schema))
		}
	
		if (resolvers) {
			spinner.text = `Loading ${typeKey} resolvers...`

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
			spinner.text = `Loading ${typeKey} loaders...`
			Object.assign(exp.loaders, loaders)
		}

		if (middleware) {
			spinner.text = `Loading ${typeKey} middleware...`
			Object.assign(exp.middleware, middleware)
		}
	
		commonResolvers.forEach((item) => {
			const target = types[typeKey][item]
			if (!target) return
	
			spinner.text = `Loading ${typeKey} ${item}...`
			const keys = Object.keys(target)
	
			keys.forEach((key) => {
				// ignore types that don't have the minimum requirements
				if (!target[key].schema && !target[key].resolver) return
	
				typesToAddMap[item] = true
	
				if (target[key].schema) {
					spinner.text = `Loading ${typeKey} ${item} ${key} schema...`
					let targetSchema = target[key].schema.trim()
	
					if (!targetSchema.startsWith('extend')) {
						targetSchema = 'extend ' + targetSchema
					}
	
					exp.typeDefs.push(gql(targetSchema))
				}
	
				if (target[key].resolver) {
					spinner.text = `Loading ${typeKey} ${item} ${key} resolver...`

					Object.defineProperty(target[key].resolver, 'name', {
						value: `${item}_${typeKey}_${key}`
					})
	
					exp.resolvers[item] = exp.resolvers[item] || {}
					exp.resolvers[item][key] = target[key].resolver
				}
			})
		})

		spinner.succeed(`Loaded ${typeKey}`)
	
		return exp
	}, {
		typeDefs: [],
		resolvers: {},
		loaders: {},
		middleware: {}
	})

	const typesToAdd = Object.keys(typesToAddMap)

	if (!typesToAdd.length) {
		throw new Error('No Query, Mutation or Subscription found. You must provide at least a valid Query schema.')
	}

	let BaseTypeDefs = '\n'

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
		getContextFns: getNestedFns.bind(null, { loaders, middleware })
	}
}

module.exports = {
	loader
}
