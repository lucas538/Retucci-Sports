// Configuração do Firebase — substitua os valores abaixo pelos dados do SEU projeto.
// Onde encontrar: Firebase Console > Ícone de engrenagem > Configurações do projeto > "Seus aplicativos" > SDK setup and configuration.
const firebaseConfig = {
    apiKey: "AIzaSyCKPm0Ahpg2TTU9ozQ11a-PZ-yzVSwk-3M",
    authDomain: "retuccisports.firebaseapp.com",
    projectId: "retuccisports",
    storageBucket: "retuccisports.firebasestorage.app",
    messagingSenderId: "718930290829",
    appId: "1:718930290829:web:159800b689944e228c1ac4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
