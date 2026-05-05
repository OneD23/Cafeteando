# Troubleshooting Expo Web: AppEntry.bundle 500 + MIME `application/json`

Si en Chrome ves errores como:

- `Failed to load resource: ... AppEntry.bundle ... 500 (Internal Server Error)`
- `Refused to execute script ... MIME type ('application/json') is not executable`

normalmente **no es CORS del backend**. Significa que Metro devolvió JSON con un error de compilación en vez de JS.

## Pasos rápidos (en orden)

1. **Detén Expo** y vuelve a iniciar con caché limpia:

```bash
cd cafetrack-mobile
npx expo start --web -c
```

2. Si sigue igual, limpia artefactos locales y reinstala:

```bash
rm -rf .expo .expo-shared node_modules
npm install
npx expo start --web -c
```

3. Verifica que el bundle web compile fuera del servidor:

```bash
npx expo export --platform web
```

Si este comando falla, te mostrará el archivo/línea real del error de sintaxis.

4. Revisa que no haya marcadores de merge en código fuente:

```bash
rg -n "<<<<<<<|>>>>>>>|=======" src
```

## Causa más común en este repo

Después de resolver conflictos en GitHub web, puede quedar código incompleto/duplicado aunque el archivo marque "0 conflicts". Eso rompe Metro y produce el 500 del bundle.

## Validación final

Cuando esté bien:

- `AppEntry.bundle` responde `application/javascript`
- desaparece el error MIME
- la app carga en `http://localhost:8081`
