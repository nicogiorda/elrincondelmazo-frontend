import AccountAccess from '../components/AccountAccess.jsx';
import { useEffect, useRef, useState } from 'react';

function Register({ cartCount, onRegister }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])

  async function handleRegister(form) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setError("");
    setLoading(true);


    try {
      const response = await fetch(
        "http://localhost:8080/api/v1/auth/register",
        {
          method: "POST", signal: controller.signal,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            firstname: form.firstName,
            lastname: form.lastName,
            email: form.email,
            password: form.password
          })
        }
      );

      if (response.status === 409) {
        throw new Error("Ya existe un usuario con este correo");
      }

      if (!response.ok) {
        throw new Error("No se pudo registrar el usuario");
      }

      const data = await response.json();
      const token = data.access_token;
      if (typeof token !== "string" || !token.trim()) throw new Error("El servidor no devolvió un token válido.");

      const responseUsuario = await fetch(
        "http://localhost:8080/users/me",
        {
          method: "GET", signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!responseUsuario.ok) {
        throw new Error("No se pudo obtener el usuario");
      }

      const usuario = await responseUsuario.json();

      if (controller.signal.aborted) return
      localStorage.setItem("token", token);


      onRegister(usuario);

    } catch (error) {
      if (controller.signal.aborted) return
      console.error("Error durante el registro:", error);
      setError(error.message);

    } finally {
      request.current = null
      setLoading(false);
    }

  }

  return (
    <AccountAccess
      mode="register"
      cartCount={cartCount}
      onSubmit={handleRegister}
      error={error}
      loading={loading}
    />
  );
}

export default Register;
