'use client'

import React, { useState } from'react'
import { supabase } from'../../lib/supabase-client'
import { useNavigate } from'react-router-dom'
import toast from'react-hot-toast'
import { Eye, EyeOff, ArrowLeft, Lock, Mail, ChevronRight, ShieldCheck } from'lucide-react'

export default function LoginPage() {
 const navigate = useNavigate()
 const [formData, setFormData] = useState({
 email:'',
 password:''
 })
 const [resetEmail, setResetEmail] = useState('')
 const [showReset, setShowReset] = useState(false)
 const [isLoading, setIsLoading] = useState(false)
 const [showPassword, setShowPassword] = useState(false)

 const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const { name, value } = e.target
 setFormData(prev => ({
 ...prev,
 [name]: value
 }))
 }

 const validateForm = () => {
 if (!formData.email.trim()) {
 toast.error('Email is required')
 return false
 }

 if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
 toast.error('Please enter a valid email address')
 return false
 }

 if (!showReset && !formData.password) {
 toast.error('Password is required')
 return false
 }

 return true
 }

 const handleLogin = async (e: React.FormEvent) => {
 e.preventDefault()

 if (!validateForm()) return

 setIsLoading(true)

 try {
 const { error } = await supabase.auth.signInWithPassword({
 email: formData.email,
 password: formData.password
 })

 if (error) throw error

 toast.success('Welcome back!')
 navigate('/main')
 } catch (err: any) {
 console.error(err)
 toast.error(err.message ||'Login failed')
 } finally {
 setIsLoading(false)
 }
 }

 const handleResetPassword = async (e: React.FormEvent) => {
 e.preventDefault()

 if (!resetEmail.trim()) {
 toast.error('Email is required')
 return
 }

 if (!/^\S+@\S+\.\S+$/.test(resetEmail)) {
 toast.error('Please enter a valid email address')
 return
 }

 setIsLoading(true)

 try {
 const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
 redirectTo:`${window.location.origin}/reset-password`,
 })

 if (error) throw error

 toast.success('Password reset link sent! Check your email.')
 setShowReset(false)
 setResetEmail('')
 } catch (err: any) {
 console.error(err)
 toast.error(err.message ||'Failed to send reset link')
 } finally {
 setIsLoading(false)
 }
 }

 return (
 <div className="flex min-h-screen bg-gray-950 font-sans selection:bg-blue-500/30 text-white">
 {/* Left Panel - Decorative (Desktop Only) */}
 <div className="hidden lg:flex w-1/2 relative bg-gray-900 overflow-hidden items-center justify-center p-12 border-r border-gray-800">
 {/* Abstract blobs */}
 <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[100px] -slow"></div>
 <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-indigo-600/10 rounded-full blur-[100px] -slow"></div>

 <div className="relative z-10 max-w-lg">
 <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
 <ShieldCheck size={24} />
 </div>
 <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
 Secure your digital life.
 </h1>
 <p className="text-xl text-gray-400 leading-relaxed">
 DropVault provides industry-leading encryption for your notes and files, ensuring your data remains yours, always.
 </p>

 <div className="mt-12 space-y-4">
 <div className="flex items-center gap-4 text-sm text-gray-500">
 <div className="flex -space-x-2">
 <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900"></div>
 <div className="w-8 h-8 rounded-full bg-gray-600 border-2 border-gray-900"></div>
 <div className="w-8 h-8 rounded-full bg-gray-500 border-2 border-gray-900"></div>
 </div>
 <p>Trusted by thousands of users</p>
 </div>
 </div>
 </div>
 </div>

 {/* Right Panel - Form */}
 <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
 <div className="w-full max-w-[400px] space-y-10">
 <div className="text-center lg:text-left">
 <h2 className="text-3xl font-bold tracking-tight text-white">
 {showReset ?'Reset Password' :'Welcome back'}
 </h2>
 <p className="mt-2 text-gray-400 text-sm">
 {showReset
 ?'Enter your email to receive recovery instructions.'
 :'Please enter your details to sign in.'}
 </p>
 </div>

 {!showReset ? (
 <form onSubmit={handleLogin} className="space-y-5">
 <div className="space-y-4">
 <div>
 <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">
 Email
 </label>
 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <Mail className="h-5 w-5 text-gray-500" />
 </div>
 <input
 type="email"
 id="email"
 name="email"
 placeholder="you@example.com"
 className="block w-full pl-10 pr-3 py-3 border border-gray-800 rounded-lg leading-5 bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-900 sm:text-sm"
 value={formData.email}
 onChange={handleChange}
 disabled={isLoading}
 />
 </div>
 </div>

 <div>
 <div className="flex items-center justify-between mb-1.5 ml-1">
 <label htmlFor="password" className="block text-sm font-medium text-gray-300">
 Password
 </label>
 <button
 type="button"
 onClick={() => setShowReset(true)}
 className="text-xs font-medium text-blue-400 hover:text-blue-300"
 disabled={isLoading}
 >
 Forgot password?
 </button>
 </div>
 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <Lock className="h-5 w-5 text-gray-500" />
 </div>
 <input
 type={showPassword ?"text" :"password"}
 id="password"
 name="password"
 placeholder="••••••••"
 className="block w-full pl-10 pr-10 py-3 border border-gray-800 rounded-lg leading-5 bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-900 sm:text-sm"
 value={formData.password}
 onChange={handleChange}
 disabled={isLoading}
 />
 <button
 type="button"
 className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 cursor-pointer"
 onClick={() => setShowPassword(!showPassword)}
 disabled={isLoading}
 >
 {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
 </button>
 </div>
 </div>
 </div>

 <button
 type="submit"
 disabled={isLoading}
 className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-900 ${isLoading ?'opacity-70 cursor-not-allowed' :''}`}
 >
 {isLoading ? (
 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
 ) : (
 <>
 Sign In <ChevronRight size={16} className="ml-1.5" />
 </>
 )}
 </button>

 <div className="text-center pt-2">
 <p className="text-sm text-gray-400">
 New to DropVault?{''}
 <button
 type="button"
 onClick={() => navigate('/register')}
 className="font-medium text-white hover:underline"
 disabled={isLoading}
 >
 Create an account
 </button>
 </p>
 </div>
 </form>
 ) : (
 <form onSubmit={handleResetPassword} className="space-y-5">
 <button
 onClick={() => setShowReset(false)}
 className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white mb-4"
 disabled={isLoading}
 >
 <ArrowLeft size={16} />
 <span>Back to login</span>
 </button>

 <div>
 <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">
 Email Address
 </label>
 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <Mail className="h-5 w-5 text-gray-500" />
 </div>
 <input
 type="email"
 id="resetEmail"
 placeholder="name@example.com"
 className="block w-full pl-10 pr-3 py-3 border border-gray-800 rounded-lg leading-5 bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-900 sm:text-sm"
 value={resetEmail}
 onChange={(e) => setResetEmail(e.target.value)}
 disabled={isLoading}
 />
 </div>
 </div>

 <button
 type="submit"
 disabled={isLoading}
 className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-900 ${isLoading ?'opacity-70 cursor-not-allowed' :''}`}
 >
 {isLoading ? (
 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
 ) : (
'Send Reset Link'
 )}
 </button>
 </form>
 )}
 </div>

 <div className="absolute bottom-6 text-center w-full text-xs text-gray-600 pointer-events-none">
 &copy; 2025 DropVault. All rights reserved.
 </div>
 </div>
 </div>
 )
}