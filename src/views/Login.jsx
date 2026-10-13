import AccountAccess from '../components/AccountAccess.jsx'

function Login({ cartCount, onLogin }) {

  async function handleLogin(form) {

    const response = await fetch(
      "http://localhost:8080/api/v1/auth/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password
        })
      }
    );

    if (!response.ok) {
      console.log("Error al iniciar sesión");
      console.log("Código HTTP:", response.status);
      return;
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
      console.log("No se pudieron obtener los datos del usuario");
      return;
    }

    const usuario = await responseUsuario.json();

    localStorage.setItem("token", token);
    console.log("Login exitoso");
    onLogin(usuario);
  }

  return (
    <AccountAccess mode="login" cartCount={cartCount} onSubmit={handleLogin} />
  );
}

export default Login;
