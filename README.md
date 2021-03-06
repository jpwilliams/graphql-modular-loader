# @jpwilliams/graphql-modular-loader

Organise and load all of your GraphQL `types`, `resolvers`, `loaders`, and `middleware` with a single, easy function. This is an opinionated loader which supports only a specific export structure. Like anything opinionated, it's good for standardising, but it's not for everybody.

``` sh
npm install --save @jpwilliams/graphql-modular-loader
```

``` javascript
// Load the './types' folder
const { loader } = require('@jpwilliams/graphql-modular-loader')
const { typeDefs, resolvers, getContextFns } = loader('./types')

// Use typeDefs and resolvers for your GraphQL server
const schema = makeExecutableSchema({
	typeDefs,
	resolvers
})

// getContextFns can be used to populate your context
// object with loaders and middleware specified throughout
// your types
// ...
const context = {
	userId: 123,
	database: MyDbConnection
}

Object.assign(context, getContextFns(context))
// ...
```

An example folder with your entire GraphQL set-up:

![An example directory tree using this package](https://user-images.githubusercontent.com/1736957/69503133-bb9feb00-0f0e-11ea-900d-6ae9615ddfef.png)

# How it works

The package will load and parse folders and files as an object, meaning schemas and resolvers can be specified either as individual files, or as a single file with multiple exports. We'll show a valid single file compared to a valid directory structure later, but for now let's look at how things might be laid out in our tree.

Anything that exports _multiple_ values can be loaded as a folder instead. For example:

``` javascript
// foo.js
module.exports.bar = 'bar'
module.exports.baz = 'baz
```

Is exactly the same as:

``` javascript
// foo/bar.js
module.exports = 'bar'
```

``` javascript
// foo/baz.js
module.exports = 'baz'
```

So how does the library expect you to lay out your schemas and resolvers? In their most separated form:

- `schema.graphql` Exports a GraphQL schema for the type you're creating.
- `resolvers/` Contains any field resolvers for this type.
  - `author.js` Exports a function that receives `(obj, args, context, info)` and returns the value for an `author` field.
- `Query/` Contains any queries related to this type.
  - `books/` Contains the schema and resolver for the `books` query.
    - `schema.graphql` Exports a GraphQL schema for the `books` query.
    - `resolver.js` Exports a function that receives `(obj, args, context, info)` and handles a `books` query.
- `Mutation/` Contains any mutations related to this type.
  - `addBook/` Contains the schema and resolver for the `addBook` mutation.
    - `schema.graphql` Exports a GraphQL schema for the `addBook` mutation.
    - `resolver.js` Exports a function that receives `(obj, args, context, info)` and handles an `addBook` mutation.
- `Subscription/` Contains any subscriptions related to this type.
  - `bookAdded/` Contains the schema and resolver for the `bookAdded` subscription.
    - `schema.graphql` Exports a GraphQL schema for the `bookAdded` subscription.
    - `resolver.js` Exports a function that receives `(obj, args, context, info)` and handles a `bookAdded` subscription.
- `loaders/` Contains any loaders related to this type. A specific export is recommended here so that loaders can be accessed from the `context` object of any resolver.
  - `bookByName.js` Adds a loader named `bookByName`. Export a function which receives a `context` object and passes back a [`DataLoader`](https://github.com/facebook/dataloader) instance. The use of a wrapping function here allows loaders to use `context`, but also means you can combat [`dataloader`'s caching trap](https://github.com/facebook/dataloader#caching-per-request) by returning a new loader on each run.
- `middleware/` Contains any middleware related to this type. A specific export is recommended here so that middleware can be accessed from the `context` object of any resolver.
  - `hasAccessToBook.js` Adds a piece of middleware named `hasAccessToBook`. Export a function which receives a `context` object and passes back a function to run when called.
  
# Using loaders and middleware with `context`
  
Regarding loaders and middleware, here's an example of what a loader called `bookByName.js` would ideally look like:

``` javascript
// bookByName.js
const DataLoader = require('dataloader')

module.exports = (context) => new DataLoader(async (bookNames) => {
	const books = await context.db.pseudoGetBooks(bookNames)
	
	const bookMap = books.reduce((map, book) => {
		map[book.name] = book
		
		return map
	}, {})
	
	return bookNames.map(bookName => bookMap[bookName])
})
```

And here might be our middleware, `hasAccessToBook.js`:

``` javascript
// hasAccessToBook.js
module.exports = (context) => async (bookId) => {
	if (!context.user.isReader) {
		throw new Error('Must be a reader to see that book!')
	}
}
```

When loading types, `getContextFns` function is exported too. This takes a context object and loads all loaders and middleware using that context. Along with that and using something like [apollographql/apollo-server](https://github.com/apollographql/apollo-server), we can add this (and any other loaders/middleware with the same format) to the `context` object for every resolver like so:

``` javascript
const { loader } = require('@jpwilliams/graphql-modular-loader')
const { ApolloServer } = require('apollo-server')

const { typeDefs, resolvers, getContextFns } = loader('./types')

const server = new ApolloServer({
	typeDefs,
	resolvers
	context: async ({ req }) => {
		// set up some basic context here.
		// maybe set up DB connections or get user data from the req.
		const context = {
			foo: 'bar',
			baz: true,
			dbConnection: '...'
		}

		Object.assign(context, getContextFns(context))
		
		return context
	}
})
```

Now, a resolver could access any loaders or middleware from our `context` object!

``` javascript
module.exports = async ({ bookName }, args, context, info) => {
	await context.middleware.hasAccessToBook(bookName)

	return context.loaders.bookByName(bookName)
}
```

# Splitting files

So all of this means we can now split up complex types in to nicely separated, bookmarked code, allowing really easy extensibility.

``` javascript
// types/Book/schema.graphql
type Book {
	title: String
	author: Author
}
```

``` javascript
// types/Book/Query/books/schema.graphql
extend type Query {
	books: [Book]
}
```

``` javascript
// types/Book/Query/books/resolver.js
module.exports = (obj, args, context, info) => [{
	title: 'Jurassic Park',
	author: {name: 'Michael Crichton'}
}]
```

``` javascript
// types/Book/Mutation/addBook/schema.graphql
extend type Mutation {
	addBook(input: AddBookInput!): AddBookOutput
}

input AddBookInput {
	title: String!
	author: String!
}

type AddBookOutput {
	book: Book
}
```

``` javascript
// types/Book/Mutation/addBook/resolver.js
module.exports = (obj, args, context, info) => psuedoAddBook(input.title, input.author)
```

``` javascript
// types/Book/Subscription/bookAdded/schema.graphql
extend type Subscription {
	bookAdded: BookAddedPayload
}

type BookAddedPayload {
	book: Book
}
```

``` javascript
// types/Book/Subscription/bookAdded/resolver.js
module.exports = (obj, args, context, info) => psuedoAsyncIterator('bookAdded')
```

``` javascript
// types/Book/resolvers/author.js
module.exports = (obj, args, context, info) => psuedoGetAuthorData()
```

You could also define this entire type in a single file. It'd work just fine with the package, but could get pretty bloated the more you add to it! This is best for very simple types like imported scalars.

``` javascript
// types/Book.js
const schema = `
type Book {
	title: String
	author: Author
}
`

const Query = {
	books: {
		schema: `extend type Query {
			books: [Book]
		}`,

		resolver: (obj, args, context, info) => [{
			title: 'Jurassic Park',
			author: {name: 'Michael Crichton'}
		}]
	}
}

const Mutation = {
	addBook: {
		schema: `extend type Mutation {
			addBook(input: AddBookInput!): AddBookOutput
		}
		
		input AddBookInput {
			title: String!
			author: String!
		}
		
		type AddBookOutput {
			book: Book
		}`,

		resolver: (obj, args, context, info) => psuedoAddBook(input.title, input.author)
	}
}

const Subscription = {
	bookAdded: {
		schema: `extend type Subscription {
			bookAdded: BookAddedPayload
		}

		type BookAddedPayload {
			book: Book
		}`,

		resolver: (obj, args, context, info) => psuedoAsyncIterator('bookAdded')
	}
}

const resolvers = {
	author: (obj, args, context, info) => psuedoGetAuthorData()
}

const loaders = {
	bookByName: () => new PsuedoDataLoader()
}

module.exports = {
	schema,
	Query,
	Mutation,
	Subscription,
	resolvers,
	loaders
}
```
