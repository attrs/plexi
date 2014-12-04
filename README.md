# plexi
[![Build Status](https://travis-ci.org/attrs/plexi.svg?branch=master)](https://travis-ci.org/attrs/plexi)

Plexi is plugin system for nodejs. Helps to make a horizontal plug-in architecture.

### Usage
##### Installation
```sh
$ sudo npm install plexi -g
```

##### Initialize project to use plexi
```sh
$ plexi init 
```

##### Install plugins
```sh
$ plexi install plexi.http --save
$ plexi install plexi.workbench plexi.mongodb@2.6 --save
```

##### Start plugin-system
```sh
$ plexi start
```

### Plexi cli
// sytem status
plexi$ p
...
 
// plugins status
plexi$ ss
0     started      plexi-example       0.0.1 
1     started      plexi.http          0.1.0 
...

// plugin detail
plexi$ p 0

// help
plexi$ h

// exit process
plexi$ q

### License

  [MIT](LICENSE)