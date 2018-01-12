# Parkes Controller

A framework for quickly setting up **REST**ful and **CRUD** compliant APIs.

## Dependencies

Parkes Controller is built for [koa 2](https://github.com/koajs/koa) and requires
async/await in node 7.6

# Getting Started

`npm install --save raisely/parkes-controller`

```javascript
const parkesController = require('parkes-controller');

const User = sequelize.define('User', ...); // define the sequalize resouce

// declare the controller model
class UserController extends ParkesController {

  // define custom handles for CRUD requests...
  show(ctx, next) {
    super(context);
    console.log('Retrieved user resource: ', ctx.state.data)
    await next();
  }

  // hook into specific CRUD events...
  async afterIndex(ctx, collection) {
      // do something cool during the request...
  }

  async beforeCreate(ctx, model) {
    // do something else cool during the request...
  }
}

// init the controller (with options)
const userController = new UserController('user', options);

// hook up to your resource router
const users = new restUp.resource('user', userController);

// and then bind to your app
app.use(users.routes);
```

Parkes Controller works in conjunction with
[ParkesRouter](https://github.com/raisely/parkes-router) and
[ParkesPresenter](https://github.com/raisely/parkes-presenter) for routing requests
and returning responses. Neither of these are strictly necessary, you can set up
routes manually, just make sure you have some middleware that takes `ctx.state.data`
and puts it on `ctx.body`.

## Initializing a controller

Generally you'll want to extend the parkes controller to provide additional methods
or override certain actions.

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

The resource name for the controller (is pluralized by ParkesRouter)

### Options `Object`

Is an object with the following keys:

Option           | Default    | Description
---------------- | ---------- | ---------------------------------------------------------------------------------------------------
models           | (required) | Object containing all of your sequelize models (they should have singular names, ie User not Users)
authorize        | false      | A CanCan style authorize function if you want to authorize your calls
resourceIdColumn | 'uuid'     | Name of the column to be used for a resource id by the api

## Hooks

As shown in the above example, Parkes Controller allows you to bind events to before
and after a primary database action occors within a request. This allows you to modify
the requests before a response is generated.

#### Parameters

`ctx` represents a Koa context object, while the second paramater represents a
single Sequelize model or collection of models (unless otherwise stated).

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

A function for authorizing requests with the following signature

```javascript
function(ctx, { model, parent, scopes, isPrivate })
```

Paramters | Type                        | Description
--------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
context   |                             | Context of the Koa request
model     | Sequelize class or instance | The model that the request is accessing, usually the record that is being viewed/updated/deleted. For create this will be the class of the object to be created
parent    | Sequelize instance          | In the case of create it's often necessary to know the record that the object will be a child of before creating the record (eg a user can only add an item to their shop )
scopes    | String[]                    | Records that a findAll request is being scoped by
isPrivate | boolean                     | true if the request query contains ?private=1

## Event emitters

On each ParkesController instance, an `EventEmitter` object property exists allowing
developers to hook non-blocking events inside of the constructor. The names and
Parameters of the events directly correspond with each `Hook` listed above.

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

 > _Please not that unlike `async` hooks, the event emitters should not be used to
modify requests or models. This is due to the event before forced to run after
it's parent call has completed._
