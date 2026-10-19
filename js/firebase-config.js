// Firebase web configuration (public client config, not a service-account key).
const firebaseConfig = {
  apiKey: "AIzaSyB115vY6gzHFgYKC-XVsO__b4phWQ20kGI",
  authDomain: "k-sci-learn-1abb8.firebaseapp.com",
  projectId: "k-sci-learn-1abb8",
  storageBucket: "k-sci-learn-1abb8.firebasestorage.app",
  messagingSenderId: "675513598918",
  appId: "1:675513598918:web:4ff8de27939596d27468c7",
  measurementId: "G-8M8TGS6ED7"
};
firebase.initializeApp(firebaseConfig);
const firebaseAuth = firebase.auth();
