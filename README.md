# Parkes Controller
Framework to get REST API up quickly.

## Dependencies
Parkes Controller is built for [koa 2](https://github.com/koajs/koa) and requires async/await
in node 7.6

# Getting Started

`npm install --save parkes-controller`

```js
const parkesController = require('parkes-controller');
const User = sequelize.define('User', ...);

class UserController extends ParkesController {
  show(ctx, next) {
    super(context);
    console.log('Retrieved user resource: ', ctx.state.data)
    await next();
  }
}

const userController = new UserController('user', options);

const users = new restUp.resource('user', userController);

app.use(users.routes);

```

Parkes Controller works in conjunction with ParkesRouter and ParkesPresenter for
routing requests and returning responses. Neither of these are strictly necessary,
you can set up routes manually, just make sure you have some middleware that takes
`ctx.state.data` and puts it on `ctx.body`.

### Initializing a controller

Generally you'll want to extend the parkes controller to provide
additional methods or override certain actions.

```js
class MyController extends ParkesController {
}

controller = new MyController('user', options);
```

Options is an object with the following keys

| Option        | Default | Description           |
| ------------- | ------- | ------ |
| models      | (required) | Object containing all of your sequelize models (they should have singular names, ie User not Users) |
| authorize    | false | A CanCan style authorize function if you want to authorize your calls |
| resourceIdColumn | 'uuid' | Name of the column to be used for a resource id by the api |


## Authorization
A function for authorizing requests with the following signature

```js
function(ctx, { model, parent, scopes, isPrivate })
```

| Paramters    | Type | Description           |
| ------------- | ------- | ------ |
| context      | | Context of the Koa request |
| model    | Sequelize class or instance | The model that the request is accessing, usually the record that is being viewed/updated/deleted. For create this will be the class of the object to be created |
| parent | Sequelize instance | In the case of create it's often necessary to know the record that the object will be a child of before creating the record (eg a user can only add an item to their shop ) |
| scopes | String[] | Records that a findAll request is being scoped by |
| isPrivate | boolean | true if the request query contains ?private=1 |
