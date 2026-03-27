"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Heading1, Heading2, ImageIcon
} from "lucide-react";

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ underline: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "rich-editor-content focus:outline-none",
      },
    },
  });

  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = () => {
        editor.chain().focus().setImage({ src: reader.result as string }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  if (!editor) return null;

  const toolbarBtn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-2 rounded-lg transition-all ${active ? "bg-indigo-100 text-indigo-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
    >
      {icon}
    </button>
  );

  return (
    <div className="border-2 border-indigo-100 rounded-2xl overflow-hidden bg-white focus-within:border-indigo-300 transition-all">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-3 bg-indigo-50/50 border-b-2 border-indigo-100">
        {toolbarBtn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 size={18} />, "Título 1")}
        {toolbarBtn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={18} />, "Título 2")}
        <div className="w-px h-6 bg-indigo-200 mx-1" />
        {toolbarBtn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold size={18} />, "Negrita")}
        {toolbarBtn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic size={18} />, "Cursiva")}
        {toolbarBtn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={18} />, "Subrayado")}
        <div className="w-px h-6 bg-indigo-200 mx-1" />
        {toolbarBtn(editor.isActive({ textAlign: "left" }), () => editor.chain().focus().setTextAlign("left").run(), <AlignLeft size={18} />, "Izquierda")}
        {toolbarBtn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), <AlignCenter size={18} />, "Centro")}
        {toolbarBtn(editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run(), <AlignRight size={18} />, "Derecha")}
        <div className="w-px h-6 bg-indigo-200 mx-1" />
        {toolbarBtn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <List size={18} />, "Lista")}
        {toolbarBtn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={18} />, "Lista numerada")}
        <div className="w-px h-6 bg-indigo-200 mx-1" />
        {toolbarBtn(false, addImage, <ImageIcon size={18} />, "Insertar imagen")}
      </div>

      {/* Editor area */}
      <div className="relative min-h-[160px] p-4">
        {!editor.getText() && (
          <p className="absolute top-4 left-4 text-gray-400 pointer-events-none select-none">
            {placeholder || "Escribe el texto del dictado aquí..."}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
