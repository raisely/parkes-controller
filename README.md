# RestUp
Framework to get REST API up quickly.

## Dependencies


# Getting Started

`npm install --save rest-up`

```
const restUp = require('rest-up');
const User = sequelize.define('User', ...);

restUp.init({
  models: { User }
});

const userController = new restUp.controller('User');

const users = new restUp.resource('user', userController);

app.use(users.routes);

```

### Initializing

```
restUp.init(options)
```

Options is an object with the following keys

| Option        | Default | Description           |
| ------------- | ------- | ------ |
| models      | (required) | Object containing all of your sequelize models (they should have singular names, ie User not Users) |
| authorize    | false | A CanCan style authorize function if you want to authorize your calls |
| resourceIdColumn | 'uuid' | Name of the column to be used for a resource id by the api |
