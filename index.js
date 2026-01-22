import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import '../utils/zodiac.dart';

class ProfileEditScreen extends StatefulWidget {
  const ProfileEditScreen({super.key});

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  // --- Controllers
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _newPasswordCtrl = TextEditingController();
  final _newPasswordAgainCtrl = TextEditingController();
  final _currentPasswordCtrl = TextEditingController(); // reauth için

  DateTime? _birthDate;
  String _gender = '';

  bool _loading = true;
  bool _saving = false;
  bool _emailVerified = false;

  static const bgColor = Color(0xFF5A3E2B);
  static const gold = Color(0xFFB89B5E);

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _emailCtrl.dispose();
    _newPasswordCtrl.dispose();
    _newPasswordAgainCtrl.dispose();
    _currentPasswordCtrl.dispose();
    super.dispose();
  }

  // ================= LOAD =================

  Future<void> _loadProfile() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception("Auth yok");

      // Auth e-posta + doğrulama
      _emailCtrl.text = user.email ?? '';
      _emailVerified = user.emailVerified;

      // Firestore profil
      final doc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
      final data = doc.data();

      if (data != null) {
        // Senin register’da 'name' var. Biz hem name hem first/last destekleyelim.
        final fullName = (data['name'] ?? '').toString().trim();
        final firstName = (data['firstName'] ?? '').toString().trim();
        final lastName = (data['lastName'] ?? '').toString().trim();

        if (firstName.isNotEmpty || lastName.isNotEmpty) {
          _firstNameCtrl.text = firstName;
          _lastNameCtrl.text = lastName;
        } else if (fullName.isNotEmpty) {
          final parts = fullName.split(RegExp(r'\s+'));
          _firstNameCtrl.text = parts.isNotEmpty ? parts.first : '';
          _lastNameCtrl.text = parts.length > 1 ? parts.sublist(1).join(' ') : '';
        }

        _gender = (data['gender'] ?? '').toString();

        final ts = data['birthDate'];
        if (ts is Timestamp) {
          _birthDate = ts.toDate();
        }
      }
    } catch (_) {
      // sessiz kalma: en azından ekranda hata gösterebilirdik, ama şimdilik snackbar
      _error("Profil yüklenemedi");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ================= AUTH HELPERS =================

  Future<void> _reauthIfNeeded(User user) async {
    // E-posta/şifre update için Firebase sık sık reauth ister.
    // Kullanıcı mevcut şifreyi girmezse denemeyiz.
    final currentPass = _currentPasswordCtrl.text.trim();
    if (currentPass.isEmpty) return;

    final email = user.email;
    if (email == null || email.isEmpty) return;

    final cred = EmailAuthProvider.credential(email: email, password: currentPass);
    await user.reauthenticateWithCredential(cred);
  }

  Future<void> _sendVerificationEmail() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    await user.sendEmailVerification();

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("Doğrulama e-postası gönderildi ✅")),
    );
  }

  // ================= SAVE =================

  bool _validateForm() {
    if (_firstNameCtrl.text.trim().isEmpty) {
      _error("Ad boş olamaz");
      return false;
    }
    if (_lastNameCtrl.text.trim().isEmpty) {
      _error("Soyad boş olamaz");
      return false;
    }
    if (_birthDate == null) {
      _error("Doğum tarihi seçiniz");
      return false;
    }
    if (_gender.isEmpty) {
      _error("Cinsiyet seçiniz");
      return false;
    }

    final email = _emailCtrl.text.trim();
    if (!email.contains('@')) {
      _error("Geçerli bir e-posta giriniz");
      return false;
    }

    final newPass = _newPasswordCtrl.text;
    final newPassAgain = _newPasswordAgainCtrl.text;

    if (newPass.isNotEmpty || newPassAgain.isNotEmpty) {
      if (newPass.length < 6) {
        _error("Yeni şifre en az 6 karakter olmalı");
        return false;
      }
      if (newPass != newPassAgain) {
        _error("Yeni şifreler eşleşmiyor");
        return false;
      }
      // Şifre değişecekse reauth gerekebilir → current password öner
      if (_currentPasswordCtrl.text.trim().isEmpty) {
        _error("Şifre değişikliği için Mevcut Şifre gerekli");
        return false;
      }
    }

    return true;
  }

  Future<void> _save() async {
    if (!_validateForm()) return;

    setState(() => _saving = true);

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception("Auth yok");

      final uid = user.uid;
      final firstName = _firstNameCtrl.text.trim();
      final lastName = _lastNameCtrl.text.trim();
      final fullName = "$firstName $lastName".trim();
      final emailInput = _emailCtrl.text.trim();
      final zodiac = getZodiacSign(_birthDate!);

      // 1) Firestore profil update (bozmadan merge)
      await FirebaseFirestore.instance.collection('users').doc(uid).set({
        // Eski alanı da dolduralım (sende 'name' kullanılıyor)
        'name': fullName,
        'firstName': firstName,
        'lastName': lastName,
        'gender': _gender,
        'birthDate': Timestamp.fromDate(_birthDate!),
        'zodiac': zodiac,
        'zodiacUpdatedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      // 2) Auth: e-posta değişti mi?
      final currentEmail = (user.email ?? '').trim();
      final emailChanged = currentEmail.isNotEmpty && emailInput != currentEmail;

      // 3) Auth: şifre değişecek mi?
      final newPass = _newPasswordCtrl.text;

      // E-posta ya da şifre güncellenecekse reauth dene (mevcut şifre alanı doluysa)
      if (emailChanged || newPass.isNotEmpty) {
        await _reauthIfNeeded(user);
      }

      if (emailChanged) {
        await user.updateEmail(emailInput);
        await user.sendEmailVerification();
        await user.reload();
      }

      if (newPass.isNotEmpty) {
        await user.updatePassword(newPass);
      }

      // reload sonrası emailVerified güncel olsun
      await user.reload();
      final refreshed = FirebaseAuth.instance.currentUser;
      final verified = refreshed?.emailVerified ?? false;

      if (!mounted) return;
      setState(() => _emailVerified = verified);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            emailChanged
                ? "Profil güncellendi ✅ E-posta doğrulaması gönderildi."
                : "Profil güncellendi ✅",
          ),
        ),
      );

      Navigator.pop(context);
    } on FirebaseAuthException catch (e) {
      // Çok görülen auth hataları
      if (e.code == 'requires-recent-login') {
        _error("Güvenlik nedeniyle tekrar giriş gerekli. Mevcut şifreyi girip tekrar deneyin.");
      } else if (e.code == 'wrong-password') {
        _error("Mevcut şifre yanlış");
      } else if (e.code == 'email-already-in-use') {
        _error("Bu e-posta zaten kullanımda");
      } else {
        _error("Güncelleme başarısız (${e.code})");
      }
    } catch (_) {
      _error("Güncelleme başarısız");
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ================= UI =================

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        title: const Text('Profili Düzenle', style: TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          if (!_emailVerified)
            TextButton(
              onPressed: _saving ? null : _sendVerificationEmail,
              child: const Text(
                "Doğrula",
                style: TextStyle(color: gold, fontWeight: FontWeight.bold),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // --- Email status
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white12,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(
                      _emailVerified ? Icons.verified : Icons.warning_amber_rounded,
                      color: _emailVerified ? gold : Colors.orangeAccent,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _emailVerified ? "E-posta doğrulandı" : "E-posta doğrulanmadı",
                        style: const TextStyle(color: Colors.white70),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // --- First/Last name
              _input('Ad', _firstNameCtrl),
              const SizedBox(height: 14),
              _input('Soyad', _lastNameCtrl),

              const SizedBox(height: 18),

              // --- Birth date
              const Text('Doğum Tarihi', style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _saving ? null : _pickBirthDate,
                child: _box(
                  child: Text(
                    _birthDate == null
                        ? 'Gün / Ay / Yıl'
                        : '${_birthDate!.day}.${_birthDate!.month}.${_birthDate!.year}',
                    style: TextStyle(
                      color: _birthDate == null ? Colors.white54 : Colors.white,
                    ),
                  ),
                ),
              ),
              if (_birthDate != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Burcun: ${getZodiacSign(_birthDate!)}',
                  style: const TextStyle(color: Colors.white70),
                ),
              ],

              const SizedBox(height: 18),

              // --- Gender
              const Text('Cinsiyet', style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _genderChip('Kadın'),
                  _genderChip('Erkek'),
                  _genderChip('Belirtmek istemiyorum'),
                ],
              ),

              const SizedBox(height: 22),

              // --- Email
              const Text('E-posta', style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 8),
              _input('E-posta', _emailCtrl, keyboardType: TextInputType.emailAddress),

              const SizedBox(height: 22),

              // --- Current password (reauth)
              const Text(
                'Mevcut Şifre (e-posta/şifre değişikliği için)',
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 8),
              _input('Mevcut Şifre', _currentPasswordCtrl, isPassword: true),

              const SizedBox(height: 18),

              // --- New password
              const Text('Yeni Şifre', style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 8),
              _input('Yeni Şifre', _newPasswordCtrl, isPassword: true),
              const SizedBox(height: 12),
              _input('Yeni Şifre (Tekrar)', _newPasswordAgainCtrl, isPassword: true),

              const SizedBox(height: 28),

              // --- Save
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: gold,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const CircularProgressIndicator(color: Colors.black)
                      : const Text(
                          'Kaydet',
                          style: TextStyle(
                            color: Colors.black,
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),

              const SizedBox(height: 12),

              const Text(
                "Not: E-posta değiştirdiğinde doğrulama e-postası gönderilir.",
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ================= WIDGET HELPERS =================

  Widget _input(
    String hint,
    TextEditingController controller, {
    bool isPassword = false,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      obscureText: isPassword,
      keyboardType: keyboardType,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Colors.white54),
        filled: true,
        fillColor: Colors.white12,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }

  Widget _genderChip(String label) {
    final selected = _gender == label;
    return GestureDetector(
      onTap: () => setState(() => _gender = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white12,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? gold : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : Colors.white70,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _box({required Widget child}) {
    return Container(
      height: 48,
      alignment: Alignment.centerLeft,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white12,
        borderRadius: BorderRadius.circular(12),
      ),
      child: child,
    );
  }

  Future<void> _pickBirthDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(2000),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      builder: (_, child) => Theme(
        data: ThemeData.dark(),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  void _error(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }
}
