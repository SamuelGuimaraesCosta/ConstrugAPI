'use strict';
var http = require('http');
var port = process.env.PORT || 3333;
const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mysql = require('mysql');
const cors = require('cors');
const fs = require('fs');
const app = express();
const router = express.Router();

var certificate = fs.readFileSync('DigiCertGlobalRootCA.crt.pem', 'utf8');

const SECRET_KEY = "construg@123";

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", 'GET,PUT,POST,DELETE');
    app.use(cors());
    next();
});

const corsOptions = {
//     origin: (origin, callback) => {
//         if (allowedOrigins.includes(origin) || !origin) {
//             callback(null, true);
//         } else {
//             callback(new Error('Origin not allowed by CORS'));
//         }
//     }
    origin: "http://localhost:8100",
    optionsSuccessStatus: 200 
}

app.options('*', cors(corsOptions));

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

var conn = mysql.createConnection({
    host: "construgmysql.mysql.database.azure.com",
    user: "construgroot",
    password: "123@construg",
    database: "construg",
    port: 3306,
    ssl: {
        ca: certificate
    }
});

conn.connect(function (err) {
    if (err)
        return console.log("Falha na conexão com BD: " + err);
    return console.log("Conexão com BD realizada com sucesso! " + conn.threadId);
});

const findUserByEmail = (email, cb) => {
    conn.query(`SELECT * FROM user WHERE EMAIL = ?`, [email], function (error, result) {
        if (typeof result !== 'undefined' && result.length > 0) {
            cb(error, result[0]);
        } else {
            cb(error, null);
        }
    });
}

const createUser = (user, cb) => {
    var sql = "INSERT INTO user (NOME, EMAIL, SENHA, DTNASCIMENTO) VALUES ?";
    var dados = [user];

    conn.query(sql, [dados], function (error, results) {
        cb(error);
    });
}

router.get('/', (req, res) => {
    res.status(200).send("Unauthorized Access!");
});

router.post("/login", cors(corsOptions), (req, res, next) => {
    const email = req.body.email;
    const senha = req.body.password;
    
    console.log("BODY REQ: " + req.body.email + "  " + req.body.senha);

    findUserByEmail(email, (err, user) => {
        if (err) {
            return res.status(500).send("Houve um erro no servidor: findUserByEmail");
        }

        if (!user) {
            return res.status(404).send("Usuario não encontrado!");
        }
        
        const result = bcrypt.compareSync(senha, user.SENHA);

        if (!result) {
           return res.status(401).send("Senha inválida!");
        } else {
           delete user.SENHA;
        }
        
        const expiresIn = 7 * 24 * 60 * 60;
        const accessToken = jwt.sign({ id: user.IDUSUARIO }, SECRET_KEY, { expiresIn: expiresIn });
        res.status(200).send({ "user": user, "TOKEN": accessToken, "EXPIRE": expiresIn })
    });
});

router.post("/register", cors(corsOptions), (req, res) => {
    const nome = req.body.nome;
    const email = req.body.email;
    const senha = bcrypt.hashSync(req.body.senha);
    const dtnasc = "1999-01-01";

    createUser([nome, email, senha, dtnasc], (err) => {
        if (err) {
            return res.status(500).send("Houve um erro no servidor: createUser: " + err);
        }

        findUserByEmail(email, (err, user) => {
            if (err) {
                return res.status(500).send("Houve um erro no servidor: findUserByEmail");
            }

            const expiresIn = 24 * 60 * 60;
            const accessToken = jwt.sign({ "id": user.idusuario }, SECRET_KEY, { "expiresIn": expiresIn });
            res.status(200).send({ "user": user, "access_token": accessToken, "expires_in": expiresIn });
        });
    });
});

app.use(router);

var serverHttp = http.createServer(app);

serverHttp.listen(port, function () {
    console.log('HTTP Express server listening on port ' + port);
});
