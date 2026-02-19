# MongoDB Docker Container
Docker con MongoDB para desarrollo

## Características
- MongoDB 6.0 en contenedor Docker
- Inicialización automática de base de datos y usuarios
- Persistencia de datos con volúmenes Docker
- Health checks para verificar estado del servicio


## Inicio Rápido
### 0. Prerrequisitos
- Docker
- Docker Compose
- MongoDB Compass (opcional, para gestión visual)

### 1. Ejecutar el contenedor
```
# Construir y levantar los servicios
docker-compose up --build

# Ejecutar en segundo plano
docker-compose up -d --build

# Ver logs en tiempo real
docker-compose logs -f
```

### 2. Verificar estado
```
# Ver estado de los contenedores
docker-compose ps

# Ver logs específicos de MongoDB
docker-compose logs mongodb

# Ver logs del seed
docker-compose logs seed
```

## Configuración
### 1. Archivos de configuración
- `docker-compose.yml` Configuración de servicios Docker
- `mongo-init.js` Script de inicialización de MongoDB
- `Dockerfile` Configuración del contenedor seed

### 2. Variables de entorno
```
MONGO_INITDB_ROOT_USERNAME: root
MONGO_INITDB_ROOT_PASSWORD: 09nwp43dFpFyBI3h4LmM
MONGODB_URI: mongodb://alumne:XGmHckQJzwzFKwBo14YA@mongodb:27017/myapp?authSource=myapp
```
### 3. Puertos
- 27018 → Puerto del host (acceso desde tu máquina)
- 27017 → Puerto del contenedor (comunicación interna)

## Estructura de la base de datos
### 1. Bases de datos creadas
- admin - Base de datos de administración
- myapp - Base de datos de la aplicación

### 2. Usuarios creados
| Usuario | Contraseña             | Base de datos | Rol       |
| ------: | ---------------------- | ------------- | --------- |
|    root | `09nwp43dFpFyBI3h4LmM` | admin         | root      |
|  alumne | `XGmHckQJzwzFKwBo14YA` | myapp         | readWrite |

### 3. Colecciones
- users - Usuarios de la aplicación

## Conexión a la base de datos
### 1. Desde MongoDB Compass
```
mongodb://alumne:XGmHckQJzwzFKwBo14YA@localhost:27018/myapp?authSource=myapp
```
### 2. Desde Node.js (fuera de Docker)
En el fichero _.env_
```
const MONGODB_URI = 'mongodb://alumne:XGmHckQJzwzFKwBo14YA@localhost:27018/myapp?authSource=myapp';
```
## Gestión y Mantenimiento
Eliminar base de datos COMPLETAMENTE (reset total)
bash
### Parar contenedores y ELIMINAR volúmenes (esto borra todos los datos)
```
docker-compose down -v
```

### Limpiar recursos Docker no utilizados
```
docker system prune -f
docker volume prune -f
```

### Iniciar de nuevo (base de datos limpia)
```
docker-compose up --build
Resetear solo los datos (mantener contenedores)
```

### Conectar y eliminar la base de datos
```
docker exec -it mongodb mongosh -u root -p 09nwp43dFpFyBI3h4LmM --authenticationDatabase admin --eval "
use myapp;
db.dropDatabase();
print('Base de datos eliminada');
"
```

### Reiniciar para re-ejecutar inicialización
```
docker-compose restart
Comandos útiles de diagnóstico
```

### Ver volúmenes existentes
```
docker volume ls
```

### Ver uso de recursos
```
docker stats
```

### Ver redes Docker
```
docker network ls
```

### Inspeccionar contenedor
```
docker inspect mongodb
```

## Solución de Problemas
### 1. Error: "Authentication failed"
Verifica que las credenciales en la cadena de conexión coincidan con mongo-init.js

Asegúrate de incluir authSource=myapp para el usuario alumne

### 2. Error: "Connection refused"
Verifica que el contenedor esté ejecutándose: docker-compose ps

Comprueba que el puerto 27018 esté disponible

Revisa logs: `docker-compose logs mongodb`

### 3. Error: "Port already in use"
```
# Ver qué proceso usa el puerto
netstat -ano | findstr :27018

# O cambiar puerto en docker-compose.yml
ports:
  - "27019:27017"  # Cambiar puerto host
```

### Los datos no persisten
Asegúrate de no usar `docker-compose down -v` (elimina volúmenes)

Verifica que el volumen esté montado: `docker volume inspect database_mongodb_data`

Reconstruir contenedores sin perder datos
```
docker-compose down
docker-compose up --build
```
## Comandos MongoDB útiles
### Conectar via terminal
```
# Como root
docker exec -it mongodb mongosh -u root -p 09nwp43dFpFyBI3h4LmM --authenticationDatabase admin

# Como usuario de aplicación
docker exec -it mongodb mongosh -u alumne -p XGmHckQJzwzFKwBo14YA --authenticationDatabase myapp
```
### Consultas comunes
```
// Ver bases de datos
db.adminCommand('listDatabases');

// Ver colecciones
db.getCollectionNames();

// Ver usuarios
db.getUsers();

// Consultar usuarios de aplicación
db.users.find().pretty();
```

## Estructura de archivos
```
database/
├── docker-compose.yml
├── Dockerfile
├── mongo-init.js
├── package.json
└── README.md
```