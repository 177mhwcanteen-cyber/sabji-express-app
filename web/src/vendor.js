// एक ही बंडल: Firebase (compat API — पुराने ऐप जैसा ही collection/doc/onSnapshot) + Android की मशीनी सुविधाएँ
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

window.firebase = firebase;
const BtPrinter = registerPlugin("BtPrinter");
window.SENative = {
  isNative: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(),
  App, BarcodeScanner, BarcodeFormat, CapacitorUpdater, BtPrinter,
};
