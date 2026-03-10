/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  History, 
  Settings, 
  Plus, 
  LogOut, 
  Utensils, 
  Flame, 
  Activity, 
  ChevronRight,
  X,
  Check,
  Loader2,
  Image as ImageIcon,
  User as UserIcon,
  Trash2,
  PlusCircle,
  Info,
  Apple,
  Beef,
  Wheat,
  Droplets,
  Calendar,
  ScanBarcode
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  orderBy,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Meal, NutritionAnalysis, Ingredient, ScannedProduct } from './types';
import { analyzeFoodImage } from './services/geminiService';
import { lookupBarcode } from './services/barcodeService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  Legend
} from 'recharts';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const errObj = JSON.parse(this.state.error.message);
        if (errObj.error) message = `Error: ${errObj.error}`;
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <X size={32} />
            </div>
            <h2 className="text-2xl font-black text-zinc-900">Application Error</h2>
            <p className="text-zinc-500">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-zinc-900 text-white font-bold rounded-xl"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Components ---

const NutriScoreBadge = ({ score }: { score: number }) => {
  const getScoreInfo = (s: number) => {
    if (s >= 80) return { label: 'Excellent', color: 'bg-emerald-500', emoji: '🟢' };
    if (s >= 60) return { label: 'Bon', color: 'bg-yellow-400', emoji: '🟡' };
    if (s >= 40) return { label: 'Moyen', color: 'bg-orange-500', emoji: '🟠' };
    return { label: 'Mauvais', color: 'bg-red-500', emoji: '🔴' };
  };

  const info = getScoreInfo(score);

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-white font-black text-sm shadow-lg ${info.color}`}>
      <span>{info.emoji}</span>
      <span>{score} - {info.label}</span>
    </div>
  );
};

const IngredientCard = ({ ingredient, onDelete }: { ingredient: Ingredient, onDelete: () => void }) => {
  const scoreColors = {
    green: 'bg-emerald-100 text-emerald-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm flex items-center gap-4"
    >
      <div className={`w-3 h-3 rounded-full ${ingredient.score === 'green' ? 'bg-emerald-500' : ingredient.score === 'orange' ? 'bg-orange-500' : 'bg-red-500'}`} />
      <div className="flex-1">
        <h5 className="font-bold text-zinc-900">{ingredient.name}</h5>
        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
          {ingredient.quantity}g â¢ {ingredient.calories} kcal â¢ P: {ingredient.protein}g â¢ C: {ingredient.carbs}g â¢ F: {ingredient.fat}g
        </p>
      </div>
      <button onClick={onDelete} className="p-2 text-zinc-300 hover:text-red-500 transition-colors">
        <Trash2 size={18} />
      </button>
    </motion.div>
  );
};

const ProgressBar = ({ value, max, color, label, emoji }: { value: number, max: number, color: string, label: string, emoji: string }) => {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
        <span className="text-zinc-600 flex items-center gap-2">
          <span className="text-base">{emoji}</span> {label}
        </span>
        <span className="text-zinc-900">{value} / {max}g</span>
      </div>
      <div className="h-4 bg-white/40 rounded-full overflow-hidden border border-white/20 shadow-inner">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${color} rounded-full shadow-lg`}
        />
      </div>
    </div>
  );
};

const MealCard = ({ meal }: { meal: Meal }) => {
  const date = meal.timestamp?.toDate ? meal.timestamp.toDate() : new Date(meal.timestamp);
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 bg-white/60 backdrop-blur-md border border-white/80 rounded-[2rem] shadow-sm hover:shadow-md transition-all group"
    >
      <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden flex-shrink-0 border border-zinc-100 shadow-inner group-hover:scale-105 transition-transform">
        {meal.imageUrl ? (
          <img src={meal.imageUrl} alt={meal.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-200">
            <Utensils size={24} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-zinc-900 truncate">{meal.name}</h4>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} â¢ {meal.type}</p>
      </div>
      <div className="text-right">
        <p className="text-xl font-black text-zinc-900">{meal.calories}</p>
        <p className="text-[10px] text-zinc-400 font-black uppercase tracking-tighter">kcal</p>
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <NutriScanApp />
    </ErrorBoundary>
  );
}

function NutriScanApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysis, setAnalysis] = useState<NutritionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  // Barcode Scanner State
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const barcodeVideoRef = useRef<HTMLVideoElement>(null);
  const barcodeStreamRef = useRef<MediaStream | null>(null);
  const barcodeScanRef = useRef<number | null>(null);
  
  // Manual Ingredient State
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [currentIngredients, setCurrentIngredients] = useState<Ingredient[]>([]);
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    quantity: 100,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    score: 'green' as 'green' | 'orange' | 'red'
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch or create profile
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || '',
              email: currentUser.email || '',
              dailyCaloriesGoal: 2000,
              dailyProteinGoal: 150,
              dailyCarbsGoal: 200,
              dailyFatGoal: 70,
              createdAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Meals Listener
  useEffect(() => {
    if (!user) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'meals'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mealList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal));
      setMeals(mealList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'meals');
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const startCamera = async () => {
    setIsCapturing(true);
    setAnalysis(null);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error", err);
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
        analyzeImage(dataUrl.split(',')[1]);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCapturedImage(base64);
        analyzeImage(base64.split(',')[1]);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeFoodImage(base64);
      setAnalysis(result);
      // Automatically add the analyzed food as an ingredient
      const mainIngredient: Ingredient = {
        id: Math.random().toString(36).substr(2, 9),
        name: result.name,
        quantity: 100,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        score: result.calories > 500 ? 'red' : result.calories > 200 ? 'orange' : 'green'
      };
      setCurrentIngredients([mainIngredient]);
    } catch (err) {
      console.error("Analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addManualIngredient = () => {
    if (!newIngredient.name) return;
    const ingredient: Ingredient = {
      ...newIngredient,
      id: Math.random().toString(36).substr(2, 9)
    };
    setCurrentIngredients([...currentIngredients, ingredient]);
    setNewIngredient({ name: '', quantity: 100, calories: 0, protein: 0, carbs: 0, fat: 0, score: 'green' });
    setIsAddingIngredient(false);
  };

  const deleteIngredient = (id: string) => {
    setCurrentIngredients(currentIngredients.filter(ing => ing.id !== id));
  };

  const calculateNutriScore = (ingredients: Ingredient[]) => {
    if (ingredients.length === 0) return 100;
    let score = 100;
    ingredients.forEach(ing => {
      if (ing.score === 'red') score -= 20;
      else if (ing.score === 'orange') score -= 5;
      else if (ing.score === 'green') score += 10;
    });
    return Math.max(0, Math.min(100, score));
  };

  const getScoreTip = (score: number, ingredients: Ingredient[]) => {
    if (score >= 80) return "Excellent choix ! Ce repas est très équilibré.";
    if (ingredients.some(i => i.score === 'red')) return "Attention aux sucres ou graisses saturées détectés.";
    if (score < 40) return "Repas très déséquilibré, essayez d'ajouter des fibres.";
    return "Bon repas, mais pourrait être plus équilibré.";
  };

  const saveMeal = async () => {
    if (!user || (!analysis && currentIngredients.length === 0)) return;
    
    const finalIngredients = currentIngredients;
    const totalNutrients = finalIngredients.reduce((acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    try {
      const meal: Meal = {
        uid: user.uid,
        name: analysis?.name || finalIngredients[0]?.name || "Repas manuel",
        calories: totalNutrients.calories,
        protein: totalNutrients.protein,
        carbs: totalNutrients.carbs,
        fat: totalNutrients.fat,
        imageUrl: capturedImage || undefined,
        timestamp: serverTimestamp(),
        type: mealType,
        ingredients: finalIngredients
      };
      await addDoc(collection(db, 'meals'), meal);
      setAnalysis(null);
      setCapturedImage(null);
      setCurrentIngredients([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'meals');
    }
  };

  // Barcode Scanner Functions
  const startBarcodeScanner = async () => {
    setIsScanningBarcode(true);
    setScannedProduct(null);
    setProductError(null);
    setManualBarcodeInput('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      barcodeStreamRef.current = stream;
      if (barcodeVideoRef.current) {
        barcodeVideoRef.current.srcObject = stream;
        await barcodeVideoRef.current.play();
      }
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        const scan = async () => {
          if (!barcodeVideoRef.current || barcodeVideoRef.current.readyState < 2) {
            barcodeScanRef.current = requestAnimationFrame(scan);
            return;
          }
          try {
            const barcodes = await detector.detect(barcodeVideoRef.current);
            if (barcodes.length > 0) { handleBarcodeDetected(barcodes[0].rawValue); return; }
          } catch {}
          barcodeScanRef.current = requestAnimationFrame(scan);
        };
        barcodeScanRef.current = requestAnimationFrame(scan);
      }
    } catch {
      setProductError("Impossible d'accéder à la caméra");
    }
  };

  const stopBarcodeScanner = () => {
    if (barcodeScanRef.current) cancelAnimationFrame(barcodeScanRef.current);
    if (barcodeStreamRef.current) barcodeStreamRef.current.getTracks().forEach(t => t.stop());
    barcodeStreamRef.current = null;
    setIsScanningBarcode(false);
    setScannedProduct(null);
    setProductError(null);
    setManualBarcodeInput('');
  };

  const handleBarcodeDetected = async (barcode: string) => {
    if (barcodeScanRef.current) cancelAnimationFrame(barcodeScanRef.current);
    if (barcodeStreamRef.current) barcodeStreamRef.current.getTracks().forEach(t => t.stop());
    barcodeStreamRef.current = null;
    setIsLoadingProduct(true);
    setProductError(null);
    try {
      const product = await lookupBarcode(barcode);
      setScannedProduct(product);
    } catch (err: any) {
      setProductError(err.message || 'Produit introuvable');
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const addScannedProductToMeals = async () => {
    if (!scannedProduct || !user) return;
    const meal = {
      uid: user.uid,
      name: scannedProduct.name,
      calories: scannedProduct.calories,
      protein: scannedProduct.protein,
      carbs: scannedProduct.carbs,
      fat: scannedProduct.fat,
      imageUrl: scannedProduct.imageUrl || '',
      timestamp: serverTimestamp(),
      type: mealType,
    };
    try {
      await addDoc(collection(db, 'meals'), meal);
      stopBarcodeScanner();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'meals');
    }
  };

  // Calculations
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaysMeals = meals.filter(m => {
    const mealDate = m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
    return mealDate >= today;
  });

  const totals = todaysMeals.reduce((acc, m) => ({
    calories: acc.calories + m.calories,
    protein: acc.protein + m.protein,
    carbs: acc.carbs + m.carbs,
    fat: acc.fat + m.fat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const caloriePercentage = profile ? Math.min(Math.round((totals.calories / profile.dailyCaloriesGoal) * 100), 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-8 shadow-xl rotate-3">
          <Utensils className="text-white" size={40} />
        </div>
        <h1 className="text-4xl font-black text-zinc-900 tracking-tight mb-4">NutriScan AI</h1>
        <p className="text-zinc-500 max-w-xs mb-12 leading-relaxed">
          The intelligent way to track your nutrition. Just snap a photo, and let AI do the rest.
        </p>
        <button 
          onClick={handleLogin}
          className="w-full max-w-xs bg-zinc-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200"
        >
          <UserIcon size={20} />
          Continue with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pastel-gradient pb-24 font-sans selection:bg-zinc-900 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/40 backdrop-blur-xl px-6 py-4 flex justify-between items-center border-b border-white/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-pink-500 rounded-lg flex items-center justify-center shadow-lg">
            <Apple className="text-white" size={18} />
          </div>
          <h2 className="text-xl font-black text-zinc-900 tracking-tight">NutriScan</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-lg">
            <img src={user.photoURL || ''} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-8">
        {activeTab === 'dashboard' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Daily Summary Card */}
            <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/60 shadow-2xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Calories du jour</p>
                    <h3 className="text-5xl font-black text-zinc-900">{totals.calories} <span className="text-lg font-bold text-zinc-400">kcal</span></h3>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <Flame className="text-white" size={28} />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="relative h-5 bg-white/50 rounded-full overflow-hidden border border-white/20 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${caloriePercentage}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <span>0 kcal</span>
                    <span>Objectif: {profile?.dailyCaloriesGoal} kcal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Macros Grid */}
            <div className="bg-white/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/60 shadow-xl space-y-8">
              <ProgressBar 
                label="Protéines" 
                emoji="🥩"
                value={totals.protein} 
                max={profile?.dailyProteinGoal || 150} 
                color="bg-gradient-to-r from-emerald-400 to-teal-500" 
              />
              <ProgressBar 
                label="Glucides" 
                emoji="🌾"
                value={totals.carbs} 
                max={profile?.dailyCarbsGoal || 200} 
                color="bg-gradient-to-r from-blue-400 to-indigo-500" 
              />
              <ProgressBar 
                label="Lipides" 
                emoji="💧"
                value={totals.fat} 
                max={profile?.dailyFatGoal || 70} 
                color="bg-gradient-to-r from-amber-400 to-orange-500" 
              />
            </div>

            {/* Recent Meals */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-black text-zinc-900 uppercase tracking-widest text-[10px]">Repas récents</h3>
                <button onClick={() => setActiveTab('history')} className="text-zinc-500 hover:text-zinc-900 transition-colors">
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="space-y-4">
                {todaysMeals.length > 0 ? (
                  todaysMeals.slice(0, 3).map(meal => (
                    <MealCard key={meal.id} meal={meal} />
                  ))
                ) : (
                  <div className="py-12 text-center bg-white/40 backdrop-blur-sm border-2 border-dashed border-white/60 rounded-[2.5rem]">
                    <Utensils className="mx-auto text-zinc-300 mb-2" size={32} />
                    <p className="text-zinc-500 text-sm font-bold">Aucun repas aujourd'hui</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center px-1">
              <h3 className="text-3xl font-black text-zinc-900">Historique</h3>
              <div className="bg-white/40 backdrop-blur-sm p-2 rounded-xl border border-white/60">
                <Calendar size={20} className="text-zinc-500" />
              </div>
            </div>
            <div className="space-y-4">
              {meals.length > 0 ? (
                meals.map(meal => (
                  <MealCard key={meal.id} meal={meal} />
                ))
              ) : (
                <div className="py-20 text-center bg-white/40 backdrop-blur-sm border-2 border-dashed border-white/60 rounded-[2.5rem]">
                  <History className="mx-auto text-zinc-300 mb-4" size={48} />
                  <p className="text-zinc-500 font-bold">Aucun repas enregistré</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <h3 className="text-3xl font-black text-zinc-900">Réglages</h3>
            
            <div className="bg-white/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/60 shadow-xl space-y-8">
              <div className="flex items-center gap-4">
                <img src={user.photoURL || ''} alt="Profile" className="w-16 h-16 rounded-2xl border-2 border-white shadow-lg" referrerPolicy="no-referrer" />
                <div>
                  <p className="font-black text-zinc-900 text-lg">{user.displayName}</p>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{user.email}</p>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="font-black text-zinc-900 uppercase tracking-widest text-[10px] ml-1">Objectifs Quotidiens</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Calories</label>
                    <input 
                      type="number" 
                      value={profile?.dailyCaloriesGoal}
                      onChange={e => setProfile(p => p ? {...p, dailyCaloriesGoal: Number(e.target.value)} : null)}
                      className="w-full bg-white/60 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Protéines (g)</label>
                    <input 
                      type="number" 
                      value={profile?.dailyProteinGoal}
                      onChange={e => setProfile(p => p ? {...p, dailyProteinGoal: Number(e.target.value)} : null)}
                      className="w-full bg-white/60 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Glucides (g)</label>
                    <input 
                      type="number" 
                      value={profile?.dailyCarbsGoal}
                      onChange={e => setProfile(p => p ? {...p, dailyCarbsGoal: Number(e.target.value)} : null)}
                      className="w-full bg-white/60 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Lipides (g)</label>
                    <input 
                      type="number" 
                      value={profile?.dailyFatGoal}
                      onChange={e => setProfile(p => p ? {...p, dailyFatGoal: Number(e.target.value)} : null)}
                      className="w-full bg-white/60 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                <button 
                  onClick={async () => {
                    if (profile) {
                      try {
                        await setDoc(doc(db, 'users', user.uid), profile);
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
                      }
                    }
                  }}
                  className="w-full bg-zinc-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-zinc-800 transition-all"
                >
                  Enregistrer les objectifs
                </button>

                <button 
                  onClick={handleLogout}
                  className="w-full bg-red-50 text-red-500 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-all"
                >
                  <LogOut size={20} />
                  Se déconnecter
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Floating Add Button */}
      <button 
        onClick={() => setIsAddingIngredient(true)}
        className="fixed bottom-28 right-6 z-40 w-16 h-16 bg-gradient-to-br from-pink-500 to-orange-400 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
      >
        <Plus size={32} />
      </button>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/40 backdrop-blur-2xl border-t border-white/20 px-6 py-4">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`p-2 transition-all ${activeTab === 'dashboard' ? 'text-zinc-900 scale-125' : 'text-zinc-400'}`}
          >
            <Activity size={24} strokeWidth={activeTab === 'dashboard' ? 3 : 2} />
          </button>

          <button
            onClick={startBarcodeScanner}
            className="p-2 transition-all text-violet-500 hover:text-violet-700 hover:scale-110 active:scale-95"
          >
            <ScanBarcode size={24} />
          </button>

          <div className="relative -top-8">
            <button 
              onClick={startCamera}
              className="w-16 h-16 bg-zinc-900 text-white rounded-full flex items-center justify-center shadow-2xl shadow-zinc-400 hover:scale-110 active:scale-95 transition-all border-4 border-white"
            >
              <Camera size={26} />
            </button>
          </div>

          <button 
            onClick={() => setActiveTab('history')}
            className={`p-2 transition-all ${activeTab === 'history' ? 'text-zinc-900 scale-125' : 'text-zinc-400'}`}
          >
            <History size={24} strokeWidth={activeTab === 'history' ? 3 : 2} />
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-2 transition-all ${activeTab === 'settings' ? 'text-zinc-900 scale-125' : 'text-zinc-400'}`}
          >
            <Settings size={24} strokeWidth={activeTab === 'settings' ? 3 : 2} />
          </button>
        </div>
      </nav>

      {/* Barcode Scanner Overlay */}
      <AnimatePresence>
        {isScanningBarcode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="flex items-center justify-between p-4 bg-black/80">
              <button onClick={stopBarcodeScanner} className="text-white p-2"><X className="w-6 h-6" /></button>
              <h2 className="text-white font-semibold text-lg">Scanner un produit</h2>
              <div className="w-10" />
            </div>

            {!scannedProduct && !isLoadingProduct && (
              <div className="flex-1 relative overflow-hidden">
                <video ref={barcodeVideoRef} className="w-full h-full object-cover" muted playsInline />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-32 relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-violet-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-violet-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-violet-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-violet-400 rounded-br-lg" />
                    <motion.div animate={{ top: ['10%','90%','10%'] }} transition={{ duration: 2, repeat: Infinity }} className="absolute left-0 right-0 h-0.5 bg-violet-400 opacity-80" />
                  </div>
                </div>
                <p className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-sm">Pointez vers un code-barres</p>
              </div>
            )}

            {isLoadingProduct && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-violet-400" />
                  <p>Recherche du produit...</p>
                </div>
              </div>
            )}

            {scannedProduct && (
              <div className="flex-1 overflow-y-auto bg-gray-900 p-4">
                <div className="max-w-sm mx-auto">
                  <div className="flex items-center gap-4 mb-6">
                    {scannedProduct.imageUrl ? (
                      <img src={scannedProduct.imageUrl} alt={scannedProduct.name} className="w-20 h-20 object-contain rounded-2xl bg-white p-1" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center"><Apple className="w-10 h-10 text-white/40" /></div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg leading-tight">{scannedProduct.name}</h3>
                      {scannedProduct.brand && <p className="text-white/60 text-sm mt-1">{scannedProduct.brand}</p>}
                      {scannedProduct.nutriscore && (
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold text-white ${scannedProduct.nutriscore === 'A' ? 'bg-green-500' : scannedProduct.nutriscore === 'B' ? 'bg-lime-500' : scannedProduct.nutriscore === 'C' ? 'bg-yellow-500' : scannedProduct.nutriscore === 'D' ? 'bg-orange-500' : 'bg-red-500'}`}>Nutri-Score {scannedProduct.nutriscore}</span>
                      )}
                    </div>
                    <div className={`w-16 h-16 rounded-full flex flex-col items-center justify-center border-4 ${scannedProduct.healthColor === 'green' ? 'border-green-400 bg-green-900/30' : scannedProduct.healthColor === 'orange' ? 'border-orange-400 bg-orange-900/30' : 'border-red-400 bg-red-900/30'}`}>
                      <span className={`text-xl font-black ${scannedProduct.healthColor === 'green' ? 'text-green-400' : scannedProduct.healthColor === 'orange' ? 'text-orange-400' : 'text-red-400'}`}>{scannedProduct.healthScore}</span>
                      <span className="text-white/60 text-xs">/100</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[{label:'Kcal',value:scannedProduct.calories,color:'text-orange-400'},{label:'Prot.',value:scannedProduct.protein+'g',color:'text-blue-400'},{label:'Gluc.',value:scannedProduct.carbs+'g',color:'text-yellow-400'},{label:'Lip.',value:scannedProduct.fat+'g',color:'text-pink-400'}].map(m => (
                      <div key={m.label} className="bg-white/10 rounded-xl p-2 text-center">
                        <p className={`font-bold text-sm ${m.color}`}>{m.value}</p>
                        <p className="text-white/50 text-xs">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  {(scannedProduct.positivePoints?.length || 0) > 0 && (
                    <div className="mb-3">
                      {scannedProduct.positivePoints!.map(p => (
                        <div key={p} className="flex items-center gap-2 text-green-400 text-sm py-1"><Check className="w-4 h-4 flex-shrink-0" /><span>{p}</span></div>
                      ))}
                    </div>
                  )}
                  {(scannedProduct.negativePoints?.length || 0) > 0 && (
                    <div className="mb-4">
                      {scannedProduct.negativePoints!.map(p => (
                        <div key={p} className="flex items-center gap-2 text-red-400 text-sm py-1"><X className="w-4 h-4 flex-shrink-0" /><span>{p}</span></div>
                      ))}
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-white/60 text-sm mb-2">Type de repas :</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(['breakfast','lunch','dinner','snack'] as const).map(t => (
                        <button key={t} onClick={() => setMealType(t)} className={`py-1.5 rounded-xl text-xs font-medium transition-all ${mealType === t ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/60'}`}>
                          {t === 'breakfast' ? 'Matin' : t === 'lunch' ? 'Midi' : t === 'dinner' ? 'Soir' : 'Snack'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={addScannedProductToMeals} className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-2xl">Ajouter au suivi</button>
                  <button onClick={() => { setScannedProduct(null); startBarcodeScanner(); }} className="w-full py-2 mt-2 text-white/60 text-sm">Scanner un autre produit</button>
                </div>
              </div>
            )}

            {productError && !scannedProduct && !isLoadingProduct && (
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <p className="text-red-400 text-center mb-4">{productError}</p>
                <div className="flex gap-3 w-full max-w-xs">
                  <input value={manualBarcodeInput} onChange={e => setManualBarcodeInput(e.target.value)} placeholder="Saisir code-barres..." className="flex-1 bg-white/10 text-white rounded-xl px-3 py-2 text-sm" />
                  <button onClick={() => handleBarcodeDetected(manualBarcodeInput)} disabled={!manualBarcodeInput} className="px-3 py-2 bg-violet-500 text-white rounded-xl text-sm disabled:opacity-50">OK</button>
                </div>
                <button onClick={() => { setProductError(null); startBarcodeScanner(); }} className="mt-3 text-violet-400 text-sm">Réessayer</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Overlay */}
      <AnimatePresence>
        {isCapturing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="flex-1 relative">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <button 
                onClick={stopCamera}
                className="absolute top-8 right-8 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white"
              >
                <X size={24} />
              </button>
              
              <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-12">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white"
                >
                  <ImageIcon size={24} />
                </button>
                <button 
                  onClick={capturePhoto}
                  className="w-20 h-20 bg-white rounded-full border-8 border-white/30 flex items-center justify-center"
                />
                <div className="w-12 h-12" /> {/* Spacer */}
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis Overlay */}
      <AnimatePresence>
        {(isAnalyzing || analysis) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className="bg-white/90 backdrop-blur-xl w-full max-w-md rounded-[3rem] p-8 space-y-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {isAnalyzing ? (
                <div className="py-20 flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 border-8 border-zinc-100 rounded-full" />
                    <div className="absolute inset-0 border-8 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="font-black text-zinc-900 uppercase tracking-widest text-sm">Analyse en cours...</p>
                </div>
              ) : (analysis || currentIngredients.length > 0) && (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-3xl font-black text-zinc-900 mb-2">{analysis?.name || "Nouveau repas"}</h3>
                      <NutriScoreBadge score={calculateNutriScore(currentIngredients)} />
                    </div>
                    <button onClick={() => { setAnalysis(null); setCurrentIngredients([]); }} className="text-zinc-300 hover:text-zinc-900">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="bg-zinc-50/50 p-4 rounded-2xl">
                    <p className="text-zinc-500 text-sm font-medium italic">
                      "{getScoreTip(calculateNutriScore(currentIngredients), currentIngredients)}"
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Calories</p>
                      <p className="text-2xl font-black text-zinc-900">
                        {currentIngredients.reduce((acc, i) => acc + i.calories, 0)} <span className="text-xs font-normal text-zinc-400">kcal</span>
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Protéines</p>
                      <p className="text-2xl font-black text-zinc-900">
                        {currentIngredients.reduce((acc, i) => acc + i.protein, 0)} <span className="text-xs font-normal text-zinc-400">g</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <h4 className="font-black text-zinc-900 uppercase tracking-widest text-[10px]">Ingrédients</h4>
                      <button 
                        onClick={() => setIsAddingIngredient(true)}
                        className="text-zinc-900 flex items-center gap-1 font-bold text-xs"
                      >
                        <PlusCircle size={16} /> Ajouter
                      </button>
                    </div>
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {currentIngredients.map(ing => (
                        <IngredientCard 
                          key={ing.id} 
                          ingredient={ing} 
                          onDelete={() => deleteIngredient(ing.id)} 
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <div className="flex gap-2">
                      {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(type => (
                        <button 
                          key={type}
                          onClick={() => setMealType(type)}
                          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all ${mealType === type ? 'bg-zinc-900 text-white shadow-xl scale-105' : 'bg-zinc-100 text-zinc-400'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={saveMeal}
                      className="w-full bg-gradient-to-r from-zinc-900 to-zinc-800 text-white font-black py-5 rounded-[2rem] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl"
                    >
                      <Check size={24} />
                      Enregistrer le repas
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ingredient Modal */}
      <AnimatePresence>
        {isAddingIngredient && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-zinc-900">Ajouter un ingrédient</h3>
                <button onClick={() => setIsAddingIngredient(false)} className="text-zinc-300 hover:text-zinc-900">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nom</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Avocat, Poulet..."
                    value={newIngredient.name}
                    onChange={e => setNewIngredient({...newIngredient, name: e.target.value})}
                    className="w-full bg-zinc-50 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Quantité (g)</label>
                    <input 
                      type="number" 
                      value={newIngredient.quantity}
                      onChange={e => setNewIngredient({...newIngredient, quantity: Number(e.target.value)})}
                      className="w-full bg-zinc-50 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Calories</label>
                    <input 
                      type="number" 
                      value={newIngredient.calories}
                      onChange={e => setNewIngredient({...newIngredient, calories: Number(e.target.value)})}
                      className="w-full bg-zinc-50 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center block">P</label>
                    <input type="number" value={newIngredient.protein} onChange={e => setNewIngredient({...newIngredient, protein: Number(e.target.value)})} className="w-full bg-zinc-50 border-none rounded-xl p-2 text-center font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center block">C</label>
                    <input type="number" value={newIngredient.carbs} onChange={e => setNewIngredient({...newIngredient, carbs: Number(e.target.value)})} className="w-full bg-zinc-50 border-none rounded-xl p-2 text-center font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center block">L</label>
                    <input type="number" value={newIngredient.fat} onChange={e => setNewIngredient({...newIngredient, fat: Number(e.target.value)})} className="w-full bg-zinc-50 border-none rounded-xl p-2 text-center font-bold" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Qualité nutritionnelle</label>
                  <div className="flex gap-2">
                    {(['green', 'orange', 'red'] as const).map(s => (
                      <button 
                        key={s}
                        onClick={() => setNewIngredient({...newIngredient, score: s})}
                        className={`flex-1 py-3 rounded-xl border-2 transition-all ${newIngredient.score === s ? (s === 'green' ? 'border-emerald-500 bg-emerald-50' : s === 'orange' ? 'border-orange-500 bg-orange-50' : 'border-red-500 bg-red-50') : 'border-zinc-100'}`}
                      >
                        <div className={`w-4 h-4 rounded-full mx-auto ${s === 'green' ? 'bg-emerald-500' : s === 'orange' ? 'bg-orange-500' : 'bg-red-500'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={addManualIngredient}
                  className="w-full bg-zinc-900 text-white font-bold py-5 rounded-2xl shadow-xl hover:bg-zinc-800 transition-all"
                >
                  Ajouter l'ingrédient
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
