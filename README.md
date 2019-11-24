# @jpwilliams/graphql-modular-loader

Organise and load all of your GraphQL `types`, `resolvers`, and `loaders` with a single, easy function.

``` sh
npm install --save @jpwilliams/graphql-modular-loader
```

``` javascript
// Load the './types' folder
const { loader } = require('@jpwilliams/graphql-modular-loader')
const { typeDefs, resolvers, loaders } = loader('./types')
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
- `loaders/` Contains any [dataloaders](https://github.com/facebook/dataloader) related to this type. Any loaders added here are available to all resolvers in the `context` object.
  - `bookByName.js` Adds a loader named `bookByName`. Exports a function which receives a `context` object and must pass back a `DataLoader` instance. The use of a wrapping function here allows loaders to use `context`, but also means you can combat [`dataloader`'s caching trap](https://github.com/facebook/dataloader#caching-per-request) by returning a new loader on each run.

For example, the following is a single-file type definition representing how data should be exported to work with the package. It's fine and will work, but over time this thing's gonna get bulky the more we add.

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

So why not split it up in to nice, separate files? It'll be parsed in exactly the same way and allows great, easy extensibility!

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
