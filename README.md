# Parkes Controller

A framework for quickly setting up **REST**ful and **CRUD** compliant APIs for sequelize models.

## Dependencies

Parkes Controller is built for [koa 2](https://github.com/koajs/koa) and requires async/await in node 7.6
Parkes Controller interfaces to Sequelize Models.

# Getting Started

`npm install --save raisely/parkes-controller`

```javascript
const parkesController = require('parkes-controller');

const User = sequelize.define('User', ...); // define the sequalize resouce

// declare the controller model
class UserController extends ParkesController {

  // define custom handlers for CRUD requests...
  show(ctx, next) {
    super(context);
    console.log('Retrieved user resource: ', ctx.state.data)
    await next();
  }

  // hook into specific CRUD events...
  async afterIndex(ctx, collection) {
      // do something cool during the request...
  }

  async beforeCreate(ctx, newRecord) {
    // Validate values in newRecord
  }
}

// init the controller (with options)
const userController = new UserController('user', options);

// hook up to your resource router
const users = new restUp.resource('user', userController);

// and then bind to your app
app.use(users.routes);
```

Parkes Controller works in conjunction with [ParkesRouter](https://github.com/raisely/parkes-router) and [ParkesPresenter](https://github.com/raisely/parkes-presenter) for routing requests and returning responses. Neither of these are strictly necessary, you can set up routes manually, just make sure you have some middleware that takes `ctx.state.data` and puts it on `ctx.body`.

## Initializing a controller

Generally you'll want to extend the parkes controller to provide additional methods or override certain actions.

```javascript
class MyController extends ParkesController {

    // you can omit the constructor...
    constructor(name, options){
        super(name, options);
        // your custom controller props
    }

    // CRUD hooks, modify REST-ful requests before and after models are generated
    async beforeShow(ctx) {}
    async afterShow(ctx, model) {}

    async beforeIndex(ctx) {}
    async afterIndex(ctx, collection) {}

    async beforeCreate(ctx, rawModel) {}
    async afterCreate(ctx, newModel) {}

    async beforeUpdate(ctx, oldModel) {}
    async afterUpdate(ctx, newModel) {}

    async beforeDestroy(ctx, oldModel) {}
    async afterDestroy(ctx, deadModel) {}
}

controller = new MyController('user', options);
```

### Name `String`

The name of the model for the controller to create an API for

### Options `Object`

Is an object with options for ParkesController which is also passed to RestHandler

Option             | Default    | Description
------------------ | ---------- | ---------------------------------------------------------------------------------------------------
authorize          | undefined  | A hook to authorize api calls. The controller will throw if this is not set, set it to false if you don't want any authorization.
authorizationScope | undefined  | Callback function for binding dynamic model associations by the `ctx.state.user` value
models             | (required) | Object containing all of your sequelize models (they should have singular names, ie User not Users)
resourceIdColumn   | 'uuid'     | Name of the column to be used for a resource id by the api
include            | []         | Default includes to be used with find or findAll (can be overridden per call)
filterAttributes   | []         | An array of attribute names that can be specified in the HTTP query that will cause a corresponding where clause in the sequelize query
scopeModels        | []         | The presence of these keys in the query or params will filter findAll queries by joining on that model. eg You could specify ['user'] when defining the posts controller to allow API calls to request all posts by a specific user either via /users/:user/posts or /posts?user=:user
search             | ['name']   | Array of fields to compare ?q= text against
restricted         | ['id', 'uuid', 'password', 'permission', 'internal', 'privateKey', 'publicKey', 'userId', 'organisationId'] | Array of fields that may not be changed by create/update requests
allowed            | []         | Allow one of the default restricted fields without redefining the rest
defaultPageLength  | 100        | Default limit for pagination


## Hooks

As shown in the above example, Parkes Controller allows you to bind events to before and after a primary database action occors within a request. This allows you to modify the requests before a response is generated.

### Hook Parameters


`ctx` represents a Koa context object, while the second paramater represents a single Sequelize model or collection of models (unless otherwise stated).

Hook Name           | Returns             | Description
------------------- | ------------------- | ---------------------------------------------------------
async beforeShow    | `(ctx)`             | Before a single model is fetched
async afterShow     | `(ctx, model)`      | After a single model is fetched
async beforeIndex   | `(ctx)`             | Before a model collection is fetched
async afterIndex    | `(ctx, collection)` | After a model collection is fetched
async beforeCreate  | `(ctx, rawModel)`   | Before a model is added to the database (raw model)
async afterCreate   | `(ctx, newModel)`   | After a model has been added to the database (full model)
async beforeUpdate  | `(ctx, oldModel)`   | Before a single model is updated
async afterUpdate   | `(ctx, newModel)`   | After a single model is updated
async beforeDestroy | `(ctx, oldModel)`   | Before a single model is destroyed (or disabled)
async afterDestroy  | `(ctx, deadModel)`  | After a single model is destroyed (or disabled)

## Authorization

A function for authorizing requests with the following signature.
This is required. If you really don't want to authorize requests, set this to false.

```javascript
function(ctx, { model, parent, scopes, isPrivate })
```

Paramters | Type                        | Description
--------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
ctx       |                             | Context of the Koa request
model     | Sequelize class or instance | The model that the request is accessing, usually the record that is being viewed/updated/deleted. For create this will be the class of the object to be created. See below for index
parent    | Sequelize instance          | In the case of create it's often necessary to know the record that the object will be a child of before creating the record (eg a user can only add an item to their shop )
scopes    | String[]                    | Records that a findAll request is being scoped by
isPrivate | boolean                     | true if the request query contains ?private=1

In the case of index, `authorize` is called twice, the first time model will be the class to be indexed, allowing you to prevent fetching large arrays from the DB if the user has no access to that model. Once the records are retrieved, model will contain the array of sequelize records.

## ParkesController and RestHandler

ParkesController delegates the bulk of the work to RestHandler which handles generating and executing sequelize queries. This allows the controller methods to remain fairly lean - generally they're of the form findRecord, authorize, beforeHook, update, afterHook. If you need more customisation of an action than the hooks can provide, then you can override the controller method and still make use of this.rest to delegate to the RestHandler.

## Event emitters

The RestHandler provides the EventEmitter interface, `EventEmitter` allowing you to hook non-blocking events in the request. The names and parameters of the events are the same as the hooks (above), but do not block the completion of the request (and so cannot be used to modify the HTTP response).

```javascript
class MyController extends ParkesController {
    constructor(name, options){
        super(name, options);

        this.rest.on('beforeCreate', (ctx, rawModel) => {
            // your non-blocking event code here...
        });
    }
}
```

> _Please not that unlike `async` hooks, the event emitters should not be used to modify requests or models. As EventEmitter events will not be synchronous with the HTTP request._
