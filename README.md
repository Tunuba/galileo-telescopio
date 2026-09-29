# El Mensajero Sideral

Una clase de astronomia con telescopios impresos en 3D que llevan un telefono dentro. La PC crea la red Wi-Fi GALILEO, los telefonos abren el cielo en 3D y el maestro lo controla todo desde su panel.

## Como se enciende

1. Conecta la PC a internet, porque Windows no deja encender el hotspot sin conexion.
2. Abre `INICIAR.bat`. Enciende el hotspot GALILEO con la clave galileo1610, arranca el servidor y abre el panel del maestro.
3. Los telefonos leen los dos codigos QR del panel, primero el del Wi-Fi y luego el del cielo.
4. `APAGAR.bat` apaga el servidor y el hotspot.

El servidor usa el puerto 9610 para el panel y el 9643 para los telefonos. El certificado se crea solo la primera vez, con el openssl que trae Git.

## La obra

La presentacion es una obra corta en primera persona para una persona que hace de Galileo y dos ayudantes. Empieza con un prologo en el que alguien del publico recibe el telescopio y viaja hasta el cuarto de Galileo, y luego Galileo va en persona por su telescopio.

- `public/obra.js` tiene el texto, los tiempos y lo que muestran los telefonos en cada paso.
- El panel del maestro muestra lo que se dice en cada momento y avanza solo.
- `public/guion.html` es el guion para imprimir o leer en el telefono.

## Impresion 3D

`impresion3d/generar.py` crea el telescopio de tres fases, el embudo para el telefono y la tapa. Necesita `pip install numpy manifold3d`. Los archivos listos para la Bambu A2L estan en `impresion3d/PARA_IMPRIMIR`.

Las texturas y el motor 3D tienen sus creditos en `CREDITOS.txt`.
