// src/pages/Login.jsx
import React from "react";
import LoginForm from "../Components/LoginForm";

function Login() {
    return (
        <div
            className="fixed inset-0 bg-cover bg-center flex items-center justify-center"
            style={{
                backgroundImage: "url('https://www.pixelstalk.net/wp-content/uploads/images6/Desktop-Futuristic-Wallpaper-HD.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                margin: 0,
                padding: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden'
            }}
        >
            <LoginForm />
        </div>
    );
}

export default Login;
