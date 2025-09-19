# World-Chat 🌐

> A real-time, privacy-focused chat application with integrated AI assistance. No databases, no tracking, just pure conversation.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://world-chat-zuyy.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-blue)](https://socket.io/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI%20Powered-orange)](https://ai.google.dev/)

## 🎯 Vision

World-Chat reimagines online communication by combining **real-time messaging** with **intelligent AI assistance** in a completely **privacy-focused environment**. No databases, no user tracking, no data persistence—just pure, ephemeral conversation with the power of AI at your fingertips.

### The Unique Twist 🔄
Switch between **Public AI mode** (shared context for the entire room) and **Private AI mode** (personal assistant) with a single click. Ask questions privately or let the AI contribute to group discussions—the choice is yours.

## ✨ Key Features

### 🔒 Privacy First
- **Zero data persistence** - No databases or user tracking
- **Ephemeral messaging** - Messages exist only in active sessions
- **No sign-up required** - Jump in with a fun, auto-generated handle

### 🤖 Dual-Mode AI Integration
- **Public AI Mode**: Shared Gemini chat session for the entire room
- **Private AI Mode**: Personal AI assistant with individual context
- **Smart Context**: AI remembers conversation history during your session
- **Instant Toggle**: Switch modes with Alt + / hotkey

### 🚀 Superior User Experience
- **Terminal-inspired UI** with smooth animations
- **Mobile-optimized** with smart keyboard handling
- **Rich Content Support**: Emoji picker + GIF integration
- **Keyboard Shortcuts** for power users (F1 for help)
- **Real-time Presence** indicators and user count

### ⚡ Performance Optimized
- **Lightweight animations** optimized for low-end devices
- **Dual-layer caching** for GIFs and media
- **Smart auto-scroll** with user scroll detection
- **Reduced motion** support for accessibility

## 🖼️ Screenshots

### Desktop Experience
<img width="500" height="894" alt="2" src="https://github.com/user-attachments/assets/520d7215-1859-46e7-9fa4-781fa9bee978" />
<img width="500" height="897" alt="3" src="https://github.com/user-attachments/assets/4d439202-7e93-449f-b889-ee4bc5e4cfca" />

<img width="500" height="897" alt="1" src="https://github.com/user-attachments/assets/f9039578-7da0-41ce-9f8a-cd69e7ef52f8" />
<img width="500" height="897" alt="4" src="https://github.com/user-attachments/assets/be59627e-03f7-447e-8a74-8b624a8b71d7" />

### Mobile Experience  
*Fully responsive design with mobile keyboard optimization*

<img width="260" height="1500" alt="4" src="https://github.com/user-attachments/assets/2f676850-efe2-4a7b-ab07-af6853ab4daf" />
<img width="260" height="1500" alt="4" src="https://github.com/user-attachments/assets/8afa4027-1ccb-4a4a-88cf-796a0a54fea8" />

### AI Mode Toggle
*Switch between Public and Private AI assistance*

<img width="393" height="150" alt="Screenshot 2025-09-19 203330" src="https://github.com/user-attachments/assets/b98455f8-e107-44d8-8dc5-6ceeb37cd174" />
<img width="263" height="130" alt="Screenshot 2025-09-19 203342" src="https://github.com/user-attachments/assets/2e15824d-6696-48a3-9061-e2cd6f6cfb66" />
<img width="459" height="280" alt="Screenshot 2025-09-19 203411" src="https://github.com/user-attachments/assets/3e7d4e38-86d6-48c9-b114-dd5fbe30d38b" />

## 🛠️ Tech Stack

**Backend**
- Node.js + Express
- Socket.IO (real-time messaging)
- Google Gemini AI (2.5-flash model)
- Axios + dotenv

**Frontend**
- Vanilla JavaScript (ES6 modules)
- DOMPurify + Marked (safe rendering)
- Emoji Mart picker
- Tailwind CSS + Custom animations

**Infrastructure**
- On-demand deployment (onRender.com)
- Environment-based configuration
- Connection state recovery
- CORS and security headers

## ⌨️ Keyboard Shortcuts

| Action | Windows | Mac | Description |
|--------|---------|-----|-------------|
| Help | `F1` | `F1` | Show/hide shortcuts overlay |
| AI Trigger | `Alt + A` | `Alt + A` | Toggle "@ai " prefix |
| AI Mode Toggle | `Alt + /` | `Alt + /` | Switch Public/Private AI mode |
| Emoji Picker | `Ctrl + E` | `⌘ + E` | Open emoji picker |
| GIF Picker | `Ctrl + G` | `⌘ + G` | Open GIF picker |
| Send Message | `Ctrl + Enter` | `⌘ + Enter` | Send current message |
| Focus Input | `Ctrl + I` | `⌘ + I` | Focus message input |
| Close Overlays | `Esc` | `Esc` | Close pickers/help |

## 🎮 Usage

### Basic Chat
1. Enter a fun username (auto-generated suggestions available)
2. Start typing and press Enter to send messages
3. See other users join and leave in real-time

### AI Assistance
1. Type `@ai` followed by your question
2. Use `Alt + /` to toggle between Public and Private modes
3. **Public Mode**: AI responses are visible to everyone
4. **Private Mode**: AI responses are only visible to you

### Rich Content
- Use `Ctrl/⌘ + E` for emoji picker
- Use `Ctrl/⌘ + G` for GIF search
- Markdown formatting is supported and safely rendered

## 🔮 Future Roadmap

### Planned Features
- **WebRTC P2P History Sharing**: Distributed chat history through peer-to-peer gossip protocol
- **Voice Messages**: Real-time audio messaging
- **File Sharing**: Ephemeral file transfer
- **Custom Themes**: User-selectable UI themes
- **Room Management**: Private rooms and moderation tools 

#### Concept
- Each client stores the recent chat history locally.  
- When a new client joins, instead of relying on the server, existing peers can "seed" the chat history to them.  
- This reduces server load and creates a distributed storage model.  

#### Limitations (current stage)
- Requires at least **one active seeder client** online.  
- With **low traffic**, new users may join and see an **empty chat** if no peers are available.  
- Building WebRTC + sync logic is complex and may be **overengineering** for now.  

#### Why consider later?
- P2P would shine when there are **always many users online**.  
- It allows **shared persistence without a database**.  
- Can reduce dependency on centralized storage while keeping chats alive longer.  


## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test thoroughly
4. **Commit with clear messages**: `git commit -m 'Add amazing feature'`
5. **Push to your branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines
- Follow existing code style and patterns
- Test on both desktop and mobile devices
- Ensure accessibility compliance
- Update documentation for new features
- **Report Issues**: [GitHub Issues](https://github.com/ashesbloom/World-Chat/issues)


## 🌟 Why World-Chat?

In an era of data harvesting and privacy concerns, World-Chat offers a refreshing alternative:

- **True Privacy**: No data persistence means your conversations truly disappear
- **AI Integration Done Right**: Context-aware assistance without compromising privacy
- **Modern UX**: Terminal aesthetics meet modern web standards
- **Mobile-First**: Optimized for touch devices and mobile keyboards
- **Developer Friendly**: Clean codebase with comprehensive documentation

Ready to experience the future of private, AI-enhanced communication? 

[![Try World-Chat Now](https://img.shields.io/badge/Try%20World--Chat-Now-brightgreen?style=for-the-badge)](https://world-chat-zuyy.onrender.com)

---

*Built for privacy-conscious users who want more than just chat.*
