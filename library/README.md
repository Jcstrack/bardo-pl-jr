# API de biblioteca

El backend Node usa SQLite (`library.sqlite`) para álbumes, canciones, pertenencia a varios álbumes y revisión. Los archivos de audio subidos se guardan en `uploads/`. La ruta se configura mediante `LIBRARY_DATA_DIR`; el contenedor monta esa carpeta del ordenador anfitrión en `/data`. En el primer arranque con SQLite vacío se importa `library.json` y se conserva ese archivo como respaldo.

Todas las rutas de biblioteca, salvo `/api/library/info` y la creación de sesión, necesitan la cookie `bardo_access` o `Authorization: Bearer <clave>`. El enlace de invitación obtiene esa cookie automáticamente al abrirse. El propietario y el invitado pueden editar; solo el propietario puede crear la invitación.

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/library` | Catálogo completo y revisión |
| GET, POST | `/api/library/albums` | Listar o crear álbum |
| GET, PATCH, DELETE | `/api/library/albums/:id` | Leer, renombrar o eliminar álbum |
| GET, POST | `/api/library/tracks` | Listar o crear canción; `?albumId=id` filtra |
| GET, PATCH, DELETE | `/api/library/tracks/:id` | Leer, editar o eliminar canción |
| POST | `/api/library/sync` | Aplicar inserciones, eliminaciones y orden en una operación |
| PUT, GET, HEAD | `/api/library/files/:id` | Subir o leer archivo; GET admite `Range` |
| POST | `/api/library/session` | Canjear invitación por cookie |
| POST | `/api/library/invite` | Crear u obtener invitación de amigo; solo propietario |

Ejemplo de creación de álbum:

```http
POST /api/library/albums
Content-Type: application/json

{"name":"Mi álbum"}
```

Responde `201` con `{"album":{"id":"…","name":"Mi álbum"},"revision":2}`. También se puede indicar un ID propio. Para una canción por URL:

```http
POST /api/library/tracks
Content-Type: application/json

{"title":"Tema","artist":"Artista","kind":"url","src":"https://example.com/audio.mp3","albumId":"ID_DEL_ALBUM"}
```

`albumIds` permite que una canción pertenezca a varios álbumes. `PATCH` acepta los campos que se quieran cambiar, por ejemplo `{"title":"Nuevo título","albumIds":["album-1","album-2"]}`. `DELETE` devuelve la revisión nueva. Al eliminar un álbum, las canciones que siguen en otro se conservan; las que queden sin álbum se quitan. Los archivos subidos de canciones eliminadas también se borran.

Para archivos locales, primero envía el audio con `PUT /api/library/files/:id`, `Content-Type: audio/…` y `X-File-Name: tema.mp3`; luego crea la canción con `kind: "file"` y el mismo ID. Se admiten hasta 100 MB por archivo. El backend crea o actualiza la base dentro de una transacción SQLite y usa modo WAL. Al hacer copia de seguridad, detén el servicio o usa un método de backup de SQLite para incluir cambios recientes del WAL.
