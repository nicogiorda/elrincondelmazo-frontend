import AccountAccess from '../components/AccountAccess.jsx';
import { useState } from 'react';

function Register({ cartCount, onRegister }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(form) {
    setError("");
    setLoading(true);


    try {
      const response = await fetch(
        "http://localhost:8080/api/v1/auth/register",
        {
          method: "POST",
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

      const responseUsuario = await fetch(
        "http://localhost:8080/users/me",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!responseUsuario.ok) {
        throw new Error("No se pudo obtener el usuario");
      }

      const usuario = await responseUsuario.json();

      localStorage.setItem("token", token);

      console.log("Registro exitoso");
      onRegister(usuario);

    } catch (error) {
      console.error("Error durante el registro:", error);
      setError(error.message);

    } finally {
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
