import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// --- UTILIDADES GLOBALES ---
const formatFriendlyDate = (fechaISO) => {
  if (!fechaISO) return '';
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const partes = fechaISO.split('-');
  if (partes.length !== 3) return fechaISO;
  const dia = parseInt(partes[2], 10);
  const mes = meses[parseInt(partes[1], 10) - 1];
  const anio = partes[0];
  return `${dia} ${mes} ${anio}`;
};

function App() {
  // --------- ESTADOS COMPARTIDOS ---------
  const [currentStep, setCurrentStep] = useState(1)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSuccess, setIsSuccess] = useState(false)
  const [isPrintMode, setIsPrintMode] = useState(false)
  const [isResultMode, setIsResultMode] = useState(false)
  const [isControlMode, setIsControlMode] = useState(false)
  const [isChecklistMode, setIsChecklistMode] = useState(false)
  const [printDesign, setPrintDesign] = useState(1)
  const [savedEventId, setSavedEventId] = useState(null) // ID del evento guardado actualmente

  // --------- ESTADO MODAL CUSTOM ---------
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, isAlert: false })

  const showAlert = (message) => setConfirmDialog({ isOpen: true, message, onConfirm: null, isAlert: true })
  const showConfirm = (message, onConfirm) => setConfirmDialog({ isOpen: true, message, onConfirm, isAlert: false })

  const hoy = new Date().toLocaleDateString('en-CA')

  // --------- ESTADOS STEP 1: EVENTO ---------
  const [formData, setFormData] = useState({
    nombre_evento: '',
    numero_evento: '',
    disciplina: '',
    fecha: hoy,
    ciudad: ''
  })

  // Híbrido de Logo 1
  const [logoMode, setLogoMode] = useState('url')
  const [logoFile, setLogoFile] = useState(null)
  const [logoUrlInput, setLogoUrlInput] = useState('')

  // Híbrido de Logo 2
  const [logo2Mode, setLogo2Mode] = useState('url')
  const [logo2File, setLogo2File] = useState(null)
  const [logo2UrlInput, setLogo2UrlInput] = useState('')

  // Híbrido Watermark
  const [watermarkMode, setWatermarkMode] = useState('url')
  const [watermarkFile, setWatermarkFile] = useState(null)
  const [watermarkUrlInput, setWatermarkUrlInput] = useState('')

  // Lista dinámica de categorías creadas por el usuario en el Paso 1
  const [categorias, setCategorias] = useState([
    { id: Date.now(), tipo: '', cant: 1 }
  ])

  const [ciudades, setCiudades] = useState([])
  const [nombresEventos, setNombresEventos] = useState([])

  const [isAddingNombre, setIsAddingNombre] = useState(false)
  const [isDeletingNombre, setIsDeletingNombre] = useState(false)
  const [nuevoNombreInput, setNuevoNombreInput] = useState('')
  const [isSavingNombre, setIsSavingNombre] = useState(false)
  const [formErrors, setFormErrors] = useState([]) // Array de IDs de campos con error
  const [tooltipField, setTooltipField] = useState(null) // Campo que muestra el tooltip de advertencia

  const [isAddingCiudad, setIsAddingCiudad] = useState(false)
  const [isDeletingCiudad, setIsDeletingCiudad] = useState(false)
  const [nuevaCiudadInput, setNuevaCiudadInput] = useState('')
  const [isSavingCiudad, setIsSavingCiudad] = useState(false)

  // --------- ESTADOS WIZARD PELEADORES (Pasos 2 al N) ---------
  // Array matriz de datos. Cada posición contiene el array de peleas de una categoría particular.
  const [fightFormsData, setFightFormsData] = useState([])


  // --------- EFECTOS DE MONTAJE ---------
  useEffect(() => {
    fetchCiudades()
    fetchNombresEventos()

    // Detectar si la sesión anterior se cerró sin limpiar (cierre de tab/navegador)
    // sessionStorage sobrevive refresh pero se limpia al cerrar el tab
    const wasRefreshed = sessionStorage.getItem('activeSession')
    const pendingCleanup = localStorage.getItem('pendingCleanupEventId')

    if (pendingCleanup && !wasRefreshed) {
      // El tab fue cerrado y reabierto → limpiar
      cleanupEvento(parseInt(pendingCleanup)).then(() => {
        localStorage.removeItem('pendingCleanupEventId')
      })
    } else if (pendingCleanup && wasRefreshed) {
      // Fue un refresh → no borrar, solo recargar
      localStorage.removeItem('pendingCleanupEventId')
    }

    // Marcar sesión activa (se borra a al cerrar el tab)
    sessionStorage.setItem('activeSession', 'true')
  }, [])

  // Guardar evento ID para limpieza si el navegador se cierra
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (savedEventId) {
        localStorage.setItem('pendingCleanupEventId', savedEventId.toString())
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [savedEventId])

  // --------- MEJORAS DE NAVEGACION (SCROLL Y BOTON ATRAS) ---------

  // 1. Efecto para Scroll al inicio al cambiar de vista o paso
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentStep, isSuccess, isPrintMode, isResultMode, isControlMode, isChecklistMode]);

  // 2. Sincronizar estado con el Historial del Navegador (Hash)
  useEffect(() => {
    let hash = '';
    if (isPrintMode) hash = 'impresion';
    else if (isResultMode) hash = 'resultados';
    else if (isControlMode) hash = 'control-resultados';
    else if (isChecklistMode) hash = 'checklist';
    else if (isSuccess) hash = 'finalizado';
    else if (currentStep > 1) hash = `paso-${currentStep}`;
    else hash = 'registro';

    // Evitar duplicar si el hash ya es el mismo (ej. al usar botón atrás)
    if (window.location.hash !== `#${hash}`) {
      window.history.pushState({ step: currentStep, mode: hash }, '', `#${hash}`);
    }
  }, [currentStep, isSuccess, isPrintMode, isResultMode, isControlMode, isChecklistMode]);

  // 3. Listener para el botón atrás del navegador o gestos
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '');

      // Cerrar vistas especiales si retrocedemos
      setIsPrintMode(hash === 'impresion');
      setIsResultMode(hash === 'resultados');
      setIsControlMode(hash === 'control-resultados');
      setIsChecklistMode(hash === 'checklist');

      if (hash === 'finalizado') {
        setIsSuccess(true);
      } else if (hash.startsWith('paso-')) {
        const step = parseInt(hash.split('-')[1]);
        if (!isNaN(step)) {
          setCurrentStep(step);
          setIsSuccess(false);
        }
      } else if (hash === 'registro' || !hash) {
        setCurrentStep(1);
        setIsSuccess(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchCiudades = async () => {
    try {
      const { data, error } = await supabase.from('ciudades').select('*').order('nombre')
      if (error) throw error
      if (data) setCiudades(data)
    } catch (err) { console.error('Error:', err) }
  }

  const fetchNombresEventos = async () => {
    try {
      const { data, error } = await supabase.from('nombres_eventos').select('*').order('nombre')
      if (error) throw error
      if (data) setNombresEventos(data)
    } catch (err) { console.error('Error:', err) }
  }

  // --------- MANEJO CATÁLOGOS ---------
  const handleSaveNuevoNombre = async () => {
    if (!nuevoNombreInput.trim()) return
    setIsSavingNombre(true)
    try {
      const { error } = await supabase.from('nombres_eventos').insert([{ nombre: nuevoNombreInput.trim() }])
      if (error) throw error
      await fetchNombresEventos()
      setFormData(prev => ({ ...prev, nombre_evento: nuevoNombreInput.trim() }))
      setNuevoNombreInput(''); setIsAddingNombre(false)
    } catch (err) { showAlert('Hubo un error al guardar.') } finally { setIsSavingNombre(false) }
  }

  const executeDeleteNombre = (nombreABorrar) => {
    if (!nombreABorrar) return
    showConfirm(`¿Seguro que quieres eliminar "${nombreABorrar}" permanentemente?`, async () => {
      try {
        const { error } = await supabase.from('nombres_eventos').delete().eq('nombre', nombreABorrar)
        if (error) throw error
        if (formData.nombre_evento === nombreABorrar) { setFormData(prev => ({ ...prev, nombre_evento: '' })) }
        await fetchNombresEventos()
        setIsDeletingNombre(false)
      } catch (err) { showAlert('Hubo un error al eliminar.') }
    })
  }

  const handleSaveNuevaCiudad = async () => {
    if (!nuevaCiudadInput.trim()) return
    setIsSavingCiudad(true)
    try {
      const { error } = await supabase.from('ciudades').insert([{ nombre: nuevaCiudadInput.trim() }])
      if (error) throw error
      await fetchCiudades()
      setFormData(prev => ({ ...prev, ciudad: nuevaCiudadInput.trim() }))
      setNuevaCiudadInput(''); setIsAddingCiudad(false)
    } catch (err) { showAlert('Hubo un error al guardar.') } finally { setIsSavingCiudad(false) }
  }

  const executeDeleteCiudad = (ciudadABorrar) => {
    if (!ciudadABorrar) return
    showConfirm(`¿Seguro que quieres eliminar "${ciudadABorrar}" permanentemente?`, async () => {
      try {
        const { error } = await supabase.from('ciudades').delete().eq('nombre', ciudadABorrar)
        if (error) throw error
        if (formData.ciudad === ciudadABorrar) { setFormData(prev => ({ ...prev, ciudad: '' })) }
        await fetchCiudades()
        setIsDeletingCiudad(false)
      } catch (err) { showAlert('Hubo un error al eliminar.') }
    })
  }


  // --------- LOGICA WIZARD DINAMICO ---------
  const handleChange1 = (e) => {
    let { name, value } = e.target
    if (name === 'disciplina') value = value.toUpperCase()
    setFormData(prev => ({ ...prev, [name]: value }))
    // Limpiar error visual y tooltip al escribir
    if (formErrors.includes(name)) {
      setFormErrors(prev => prev.filter(f => f !== name))
    }
    if (tooltipField === name) setTooltipField(null)
  }

  // Lógica de Categorías Step 1
  const agregarCategoria = () => setCategorias([...categorias, { id: Date.now(), tipo: '', cant: 1 }])
  const removeCategoria = (idx) => setCategorias(categorias.filter((_, i) => i !== idx))
  const updateCategoria = (idx, field, val) => {
    const newCats = [...categorias]
    if (field === 'tipo') val = val.toUpperCase()
    newCats[idx][field] = val
    setCategorias(newCats)
    // Limpiar error visual de categorías
    if (formErrors.includes('categories')) {
      setFormErrors(prev => prev.filter(f => f !== 'categories'))
    }
    if (tooltipField === 'categories') setTooltipField(null)
  }

  const proceedFromStep1 = (e) => {
    e.preventDefault()

    // 1. Validar Datos Básicos y Logo (Campos Obligatorios)
    const logoInvalido = (logoMode === 'url' && !logoUrlInput.trim()) || (logoMode === 'file' && !logoFile);

    // Lista de campos que faltan
    const errors = [];
    if (!formData.nombre_evento.trim()) errors.push('nombre_evento');
    if (!formData.ciudad.trim()) errors.push('ciudad');
    if (!formData.disciplina.trim()) errors.push('disciplina');
    if (!formData.fecha) errors.push('fecha');
    if (logoInvalido) errors.push('logo');

    if (errors.length > 0) {
      setFormErrors(errors);
      setTooltipField(errors[0]);

      // Auto-focus al primer error
      setTimeout(() => {
        const first = errors[0];
        let el = null;
        if (first === 'logo') {
          el = logoMode === 'url' ? document.getElementById('input-logo-url') : document.getElementById('logo-upload');
        } else {
          el = document.getElementById(`input-${first}`);
        }
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 100);
      return;
    }

    // Si llegamos aquí todo lo básico está bien
    setFormErrors([]);
    setTooltipField(null);

    const categoriasValidas = categorias.filter(c => c.tipo.trim() !== '' && parseInt(c.cant) > 0);
    if (categoriasValidas.length === 0) {
      setFormErrors(prev => [...prev, 'categories']);
      setTooltipField('categories');

      // Focus al primer campo de categoría
      setTimeout(() => {
        const el = document.getElementById('input-cat-tipo-0');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 100);
      return;
    }

    // Estrategia de conservación de memoria si el usuario clickea Atraás/Adelante
    const newFightData = categoriasValidas.map((cat) => {
      const grupoExistente = fightFormsData.find(grupo => grupo.length > 0 && grupo[0].tipo_pelea.trim() === cat.tipo.trim());
      const cantidad = parseInt(cat.cant);

      if (grupoExistente) {
        const clon = [...grupoExistente];
        // Añadir campos vacios si el usuario incrementó la cantidad
        while (clon.length < cantidad) {
          clon.push({ tipo_pelea: cat.tipo.trim(), rojo_nombre: '', rojo_apodo: '', rojo_apellido: '', azul_nombre: '', azul_apodo: '', azul_apellido: '' });
        }
        clon.forEach(f => f.tipo_pelea = cat.tipo.trim()); // Por si hubo cambios leves de case
        return clon.slice(0, cantidad); // Rebanar si el usuario bajó la cantidad
      } else {
        // Grupo enteramente nuevo
        return Array.from({ length: cantidad }, () => ({
          tipo_pelea: cat.tipo.trim(),
          rojo_nombre: '', rojo_apodo: '', rojo_apellido: '', azul_nombre: '', azul_apodo: '', azul_apellido: ''
        }))
      }
    });

    setFightFormsData(newFightData)
    setCurrentStep(2) // Siempre avanza al paso 2, indexArray => 0
  }

  const handleVolverAPasoAnterior = () => {
    setCurrentStep(prev => prev - 1)
  }

  const proceedNextCategoryOrSave = (e) => {
    e.preventDefault()

    // Si terminamos las iteraciones normales de categorias, pasamos a la PANTALLA EXCLUSIVA DE RESUMEN
    // Sabemos esto porque totalPasosNormales = 1 (Paso 1) + categoriasValidas.length
    const totalPasosExisten = fightFormsData.length + 1;

    if (currentStep <= totalPasosExisten) {
      setCurrentStep(prev => prev + 1)
    }
  }


  // --------- MANEJADORES DE PELEADORES (Cambios en Textboxes) ---------
  // IndexGrupo = En qué arreglo maestro de categoría estamos. 
  // IndexPelea = Cual pelea de la categoria.
  const handlePeleaChange = (indexGrupo, indexPelea, campo, valor) => {
    const nuevaData = [...fightFormsData];
    // Convertir a mayúsculas campos de texto de peleadores
    const camposMayus = ['rojo_nombre', 'rojo_apellido', 'rojo_apodo', 'azul_nombre', 'azul_apellido', 'azul_apodo'];
    if (camposMayus.includes(campo)) valor = valor.toUpperCase();

    nuevaData[indexGrupo][indexPelea][campo] = valor;
    setFightFormsData(nuevaData);
  }

  // --------- ENVÍO FINAL Y DEFINITIVO AL GUARDAR ULTIMO PASO ---------
  const handleSubmitFINAL = async () => {
    setStatus({ type: 'loading', message: 'Procesando toda la información...' })

    try {
      // 0. SUBIR IMAGENES SI ES NECESARIO
      let finalLogoUrl = null
      let finalLogo2Url = null
      let finalWatermarkUrl = null

      // 1. Marca de Agua
      if (watermarkMode === 'cramm') {
        finalWatermarkUrl = '/logo_cramm.png'
      } else if (watermarkMode === 'url' && watermarkUrlInput.trim()) {
        finalWatermarkUrl = watermarkUrlInput.trim()
      } else if (watermarkMode === 'file' && watermarkFile) {
        setStatus({ type: 'loading', message: 'Subiendo marca de agua...' })
        const fileExt = watermarkFile.name.split('.').pop()
        const fileName = `watermark_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, watermarkFile)
        if (uploadError) throw new Error('Error al subir la marca de agua: ' + uploadError.message)

        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath)
        finalWatermarkUrl = publicUrlData.publicUrl
      }

      // 2. Logo 1 (Principal)
      if (logoMode === 'cramm') {
        finalLogoUrl = '/logo_cramm.png'
      } else if (logoMode === 'url' && logoUrlInput.trim()) {
        finalLogoUrl = logoUrlInput.trim()
      } else if (logoMode === 'file' && logoFile) {
        setStatus({ type: 'loading', message: 'Subiendo logo principal...' })
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, logoFile)
        if (uploadError) throw new Error('Error al subir la imagen al Storage. ¿Creaste el bucket "logos"?: ' + uploadError.message)

        // Obtener la URL publica generada misteriosamente por supabase
        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath)
        finalLogoUrl = publicUrlData.publicUrl
      }

      if (logo2Mode === 'url' && logo2UrlInput.trim()) {
        finalLogo2Url = logo2UrlInput.trim()
      } else if (logo2Mode === 'file' && logo2File) {
        setStatus({ type: 'loading', message: 'Procesando segundo archivos...' })
        const fileExt = logo2File.name.split('.').pop()
        const fileName = `logo2_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, logo2File)
        if (uploadError) throw new Error('Error al subir la segunda imagen al Storage: ' + uploadError.message)

        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath)
        finalLogo2Url = publicUrlData.publicUrl
      }

      setStatus({ type: 'loading', message: 'Guardando datos...' })

      // 1. Guardar primero el Evento Base
      const payloadEvento = {
        nombre_evento: formData.nombre_evento,
        numero_evento: formData.numero_evento ? parseInt(formData.numero_evento) : null,
        disciplina: formData.disciplina,
        fecha: formData.fecha,
        ciudad: formData.ciudad,
        logo_url: finalLogoUrl, // Logo 1
        logo2_url: finalLogo2Url, // Nuevo Logo 2
        watermark_url: finalWatermarkUrl, // Marca de agua
        peleas_preliminares: 0, // Parche de retrocompatibilidad: Obligatorio para Supabase
        peleas_profesionales: 0 // Parche de retrocompatibilidad: Obligatorio para Supabase
      }

      const { data: dbEventos, error: errEventos } = await supabase.from('eventos').insert([payloadEvento]).select()
      if (errEventos) throw errEventos
      if (!dbEventos || dbEventos.length === 0) throw new Error("No se pudo obtener el ID del evento de Supabase.")

      const nuevoIdEventoGenerado = dbEventos[0].id

      // 2. Extraer TODA LA DATA de fightFormsData en un solo arreglo lineal (Flatten)
      const todasLasPeleasPayload = [];

      fightFormsData.forEach((grupoCategoria) => {
        grupoCategoria.forEach((pelea, indexLogico) => {
          todasLasPeleasPayload.push({
            evento_id: nuevoIdEventoGenerado,
            tipo_pelea: pelea.tipo_pelea, // "Amateur", "Kickboxing", "Profesional"
            orden: indexLogico + 1,       // 1, 2, 3 de su respectivo tipo
            rojo_nombre: pelea.rojo_nombre, rojo_apodo: pelea.rojo_apodo || null, rojo_apellido: pelea.rojo_apellido,
            azul_nombre: pelea.azul_nombre, azul_apodo: pelea.azul_apodo || null, azul_apellido: pelea.azul_apellido
          });
        });
      });

      if (todasLasPeleasPayload.length > 0) {
        const { data: dbPeleas, error: errPeleas } = await supabase.from('peleas').insert(todasLasPeleasPayload).select()
        if (errPeleas) throw errPeleas
      }

      // 3. ¡Éxito absoluto! Guardar ID para cleanup futuro y pasar a pantalla Permanente
      setSavedEventId(nuevoIdEventoGenerado)
      localStorage.setItem('pendingCleanupEventId', nuevoIdEventoGenerado.toString())
      setStatus({ type: 'success', message: '¡Cartelera Subida y Procesada!' })
      setIsSuccess(true)

    } catch (err) {
      console.error("Error Paso Final:", err)
      setStatus({ type: 'error', message: 'Error de base de datos de subida total: ' + err.message })
    }
  }


  // --------- FUNCIÓN DE LIMPIEZA DE BASE DE DATOS ---------
  const cleanupEvento = async (eventoId) => {
    if (!eventoId) return
    try {
      // 1. Obtener el evento para extraer URLs de logos
      const { data: eventoData } = await supabase.from('eventos').select('logo_url, logo2_url, watermark_url').eq('id', eventoId).single()

      // 2. Borrar peleas asociadas
      await supabase.from('peleas').delete().eq('evento_id', eventoId)

      // 3. Borrar el evento
      await supabase.from('eventos').delete().eq('id', eventoId)

      // 4. Borrar imágenes del Storage si fueron subidas (no URLs externas)
      if (eventoData) {
        const supabaseStorageBase = supabase.storage.from('logos')
        const urlsToDelete = [eventoData.logo_url, eventoData.logo2_url, eventoData.watermark_url]
          .filter(url => url && url.includes('/storage/v1/object/public/logos/'))
          .map(url => url.split('/storage/v1/object/public/logos/')[1])
        if (urlsToDelete.length > 0) {
          await supabaseStorageBase.remove(urlsToDelete)
        }
      }
    } catch (err) {
      console.error('Error al limpiar evento:', err)
    }
  }

  const resetFormulario = async () => {
    // Limpiar datos de la base de datos del evento actual
    if (savedEventId) {
      await cleanupEvento(savedEventId)
      setSavedEventId(null)
      localStorage.removeItem('pendingCleanupEventId')
    }
    setIsSuccess(false)
    setIsPrintMode(false)
    setIsResultMode(false)
    setIsControlMode(false)
    setIsChecklistMode(false)
    setPrintDesign(1)
    setStatus({ type: '', message: '' })
    const hoy = new Date().toLocaleDateString('en-CA')
    setFormData({ nombre_evento: '', numero_evento: '', disciplina: '', fecha: hoy, ciudad: '' })
    setLogoFile(null); setLogoUrlInput(''); setLogoMode('url');
    setLogo2File(null); setLogo2UrlInput(''); setLogo2Mode('url');
    setWatermarkFile(null); setWatermarkUrlInput(''); setWatermarkMode('url');
    setCategorias([{ id: Date.now(), tipo: '', cant: 1 }])
    setFightFormsData([])
    setFormErrors([])
    setCurrentStep(1)
  }

  // ==========================================
  //                RENDERS
  // ==========================================

  // --- RENDERIZADOR MAGISTRAL DINÁMICO ---
  // Componente Tooltip de Validación
  const ValidationTooltip = ({ message }) => (
    <div className="absolute top-[calc(100%+8px)] left-2 z-[90] animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="relative bg-white border border-gray-200 rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.15)] py-2.5 px-4 flex items-center gap-3">
        {/* Triangulito */}
        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-l border-t border-gray-200 transform rotate-45"></div>
        {/* Icono Exclamación Naranja */}
        <div className="bg-[#ff9800] rounded-sm w-5 h-5 min-w-[20px] flex items-center justify-center text-white font-bold text-xs shadow-sm">!</div>
        <span className="text-[#333] text-[13px] font-medium whitespace-nowrap">{message}</span>
      </div>
    </div>
  );

  const renderPeleasPaso = () => {
    // Calculamos qué grupo de categoría deberíamos renderizar basado en nuestro Step mágico.
    // Step 2 => Indice Grupo 0
    // Step 3 => Indice Grupo 1
    const indiceLogicoDeGrupo = currentStep - 2;
    const arrayPeleasDelPaso = fightFormsData[indiceLogicoDeGrupo];

    if (!arrayPeleasDelPaso) return null; // Defensive render if out of bounds

    const nombreCategoria = arrayPeleasDelPaso[0]?.tipo_pelea || 'Desconocida';

    // Averiguar si cerraremos final al dar Siguiente
    const isUltimoPaso = currentStep === (fightFormsData.length + 1);

    return (
      <div className="p-5 sm:p-8">

        {/* Cabecera Resumen parecida a la imagen enviada */}
        <div className="mb-6 p-4 sm:p-5 bg-[#f8f9fa] border border-[#e1e8f0] rounded-md">
          <p className="m-0 text-[#111] font-medium leading-relaxed text-sm sm:text-base">
            <span className="font-bold uppercase text-[#b91d22]">{formData.nombre_evento}</span>{formData.numero_evento && `: ${formData.numero_evento}`}<br />
            Fecha: {formatFriendlyDate(formData.fecha)}, Sede: {formData.ciudad?.toUpperCase()} | Disciplina: {formData.disciplina || 'Varias'}<br />
            Actualmente llenando tarjeta: <strong className="text-[#b91d22] uppercase">{nombreCategoria}</strong> ({arrayPeleasDelPaso.length} {arrayPeleasDelPaso.length === 1 ? 'pelea' : 'peleas'})
          </p>
        </div>

        <form onSubmit={proceedNextCategoryOrSave} autoComplete="off">
          <div className="space-y-8">
            {arrayPeleasDelPaso.map((pelea, indexEnSuGrupo) => (
              <div key={`fight-card-${indexEnSuGrupo}`} className="bg-white border border-[#e1e8f0] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.04)]">

                <div className="bg-[#fcfcfc] border-b border-[#e1e8f0] px-5 py-3">
                  <h3 className="m-0 text-lg font-bold text-[#111]">
                    Pelea {nombreCategoria} #{indexEnSuGrupo + 1}
                  </h3>
                </div>

                <div className="p-5 space-y-6">
                  {/* ESQUINA ROJA */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-4 h-4 bg-[#e74c3c] rounded-sm"></div>
                      <span className="font-semibold text-[#111] uppercase tracking-wide text-sm">Esquina Roja</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Nombre *</label>
                        <input type="text" required
                          value={pelea.rojo_nombre}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'rojo_nombre', e.target.value)}
                          placeholder="NOMBRE"
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#e74c3c] focus:border-[#e74c3c] bg-white transition-all uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Apellido *</label>
                        <input type="text" required
                          value={pelea.rojo_apellido}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'rojo_apellido', e.target.value)}
                          placeholder="APELLIDO"
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#e74c3c] focus:border-[#e74c3c] bg-white transition-all uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Apodo (Opcional)</label>
                        <input type="text"
                          value={pelea.rojo_apodo}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'rojo_apodo', e.target.value)}
                          placeholder="APODO"
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#e74c3c] focus:border-[#e74c3c] bg-white transition-all uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-[#e1e8f0]" />

                  {/* ESQUINA AZUL */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-4 h-4 bg-[#3498db] rounded-sm"></div>
                      <span className="font-semibold text-[#111] uppercase tracking-wide text-sm">Esquina Azul</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Nombre *</label>
                        <input type="text" required
                          value={pelea.azul_nombre}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'azul_nombre', e.target.value)}
                          placeholder="NOMBRE"
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#3498db] focus:border-[#3498db] bg-white transition-all uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Apellido *</label>
                        <input type="text" required
                          value={pelea.azul_apellido}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'azul_apellido', e.target.value)}
                          placeholder="APELLIDO"
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#3498db] focus:border-[#3498db] bg-white transition-all uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Apodo (Opcional)</label>
                        <input type="text"
                          value={pelea.azul_apodo}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'azul_apodo', e.target.value)}
                          placeholder="APODO"
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#3498db] focus:border-[#3498db] bg-white transition-all uppercase"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 border-t border-[#e1e8f0] pt-6 px-4">
            <button type="submit" disabled={status.type === 'loading'} className={`w-full max-w-[350px] ${isUltimoPaso ? 'bg-[#b91d22] hover:bg-[#a0181d]' : 'bg-[#3a475a] hover:bg-[#2a3442]'} disabled:opacity-50 text-white border-none py-3.5 px-6 text-[15px] font-bold rounded-md cursor-pointer transition-colors shadow-sm tracking-wide`}>
              {status.type === 'loading' ? 'SUBIENDO ESPERE...' : (isUltimoPaso ? 'VER RESUMEN FINAL' : 'CONTINUAR SIGUIENTE CATEGORÍA')}
            </button>
            <button type="button" disabled={status.type === 'loading'} onClick={handleVolverAPasoAnterior} className="w-full max-w-[350px] bg-white hover:bg-[#f8f9fa] text-[#333] border border-[#ccc] py-3 px-6 text-[14px] font-semibold rounded-md cursor-pointer transition-colors shadow-sm">
              VOLVER ATRÁS
            </button>
          </div>
        </form>

      </div>
    )
  }

  // --- RENDERIZADO PANTALLA DE RESUMEN FINAL ---
  const renderResumenFinal = () => {
    let totalPeleasAbsolutas = 0;
    fightFormsData.forEach(g => totalPeleasAbsolutas += g.length);

    return (
      <div className="p-5 sm:p-8 bg-[#fefefe]">

        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-[#111] uppercase tracking-wide mb-2">Revisión de tu Evento</h2>
          <p className="text-[#666] text-sm hidden sm:block">Por favor, verifica que todos los datos capturados y la cartelera sean los correctos.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Panel Izquierdo: General */}
          <div className="bg-[#f8f9fa] border border-[#e1e8f0] p-5 rounded-md shadow-sm">
            <h3 className="text-[13px] uppercase text-[#888] font-bold tracking-widest mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-lg">assignment</span> Datos Generales</h3>
            <ul className="text-[15px] text-[#333] space-y-2 list-none p-0 m-0">
              <li><strong>Nombre:</strong> {formData.nombre_evento} {formData.numero_evento ? `#${formData.numero_evento}` : ''}</li>
              <li><strong>Disciplina:</strong> {formData.disciplina || 'Varias'}</li>
              <li><strong>Fecha:</strong> {formatFriendlyDate(formData.fecha)}</li>
              <li><strong>Sede:</strong> {formData.ciudad}</li>
            </ul>
          </div>

          {/* Panel Derecho: Logos */}
          <div className="bg-[#f8f9fa] border border-[#e1e8f0] p-5 rounded-md shadow-sm">
            <h3 className="text-[13px] uppercase text-[#888] font-bold tracking-widest mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-lg">image</span> Elementos Gráficos</h3>
            <div className="flex gap-4 items-start">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-[#555]">LOGO 1</span>
                <div className="w-[100px] h-[100px] border border-[#ccc] bg-white rounded flex justify-center items-center overflow-hidden">
                  {(logoMode === 'cramm' || (logoMode === 'url' && logoUrlInput) || (logoMode === 'file' && logoFile)) ?
                    <img src={logoMode === 'cramm' ? '/logo_cramm.png' : (logoMode === 'url' ? logoUrlInput : URL.createObjectURL(logoFile))} alt="L1" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">Ninguno</span>}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-[#555]">LOGO 2</span>
                <div className="w-[100px] h-[100px] border border-[#ccc] bg-white rounded flex justify-center items-center overflow-hidden">
                  {(logo2Mode === 'url' && logo2UrlInput) || (logo2Mode === 'file' && logo2File) ?
                    <img src={logo2Mode === 'url' ? logo2UrlInput : URL.createObjectURL(logo2File)} alt="L2" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">Ninguno</span>}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-[#555]">MARCA DE AGUA</span>
                <div className="w-[80px] h-[80px] border border-[#ccc] bg-white rounded flex justify-center items-center overflow-hidden">
                  {(watermarkMode === 'cramm' || (watermarkMode === 'url' && watermarkUrlInput) || (watermarkMode === 'file' && watermarkFile)) ?
                    <img src={watermarkMode === 'cramm' ? '/logo_cramm.png' : (watermarkMode === 'url' ? watermarkUrlInput : URL.createObjectURL(watermarkFile))} alt="Watermark" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">Ninguno</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Completo: Cartelera Extendida */}
        <div className="bg-white border text-center sm:text-left border-[#e1e8f0] rounded-md shadow-sm overflow-hidden mb-8">
          <div className="bg-[#b91d22] text-white px-5 py-3 flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider m-0 flex items-center gap-2"><span className="material-symbols-outlined text-base">local_fire_department</span> Cartelera de Combates</h3>
            <span className="bg-white text-[#b91d22] text-xs font-bold px-2 py-1 rounded-sm">{totalPeleasAbsolutas} Combates en Total</span>
          </div>

          <div className="p-0">
            {fightFormsData.map((grupo, gIdx) => {
              if (!grupo || grupo.length === 0) return null;
              return (
                <div key={`resumen-cat-${gIdx}`} className="border-b border-[#eee] last:border-0">
                  <div className="bg-[#fcfcfc] px-4 py-2 border-b border-[#eee] flex items-center justify-between">
                    <h4 className="m-0 text-[#444] text-[13px] font-bold uppercase tracking-wide flex items-center gap-2"><span className="material-symbols-outlined text-sm">emoji_events</span> Categoría: {grupo[0].tipo_pelea}</h4>
                    <span className="text-xs font-semibold text-gray-500">{grupo.length} Peleas</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-0">
                    {grupo.map((pelea, pIdx) => (
                      <div key={`resumen-p-${gIdx}-${pIdx}`} className="p-4 border-r border-b border-[#eee] last:border-r-0 flex flex-col justify-center">
                        <div className="text-[11px] text-gray-400 font-bold mb-2 uppercase text-center w-full">Pelea #{pIdx + 1}</div>
                        <div className="flex items-center justify-between text-[13px]">
                          <div className="text-right w-[45%]">
                            <span className="block font-bold text-[#e74c3c] uppercase">{pelea.rojo_nombre} {pelea.rojo_apellido}</span>
                            {pelea.rojo_apodo && <span className="block text-[10px] text-gray-500 uppercase">'{pelea.rojo_apodo}'</span>}
                          </div>
                          <div className="text-center w-[10%] text-[#ccc] font-black text-xs italic">VS</div>
                          <div className="text-left w-[45%]">
                            <span className="block font-bold text-[#3498db] uppercase">{pelea.azul_nombre} {pelea.azul_apellido}</span>
                            {pelea.azul_apodo && <span className="block text-[10px] text-gray-500 uppercase">'{pelea.azul_apodo}'</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-[#e1e8f0] pt-8 px-4">
          <button type="button" disabled={status.type === 'loading'} onClick={handleSubmitFINAL} className="w-full max-w-[400px] bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white border-none py-4 px-6 text-[15px] font-black uppercase tracking-wider rounded-md cursor-pointer transition-colors shadow-md">
            {status.type === 'loading' ? 'PROCESANDO...' : 'SIGUIENTE'}
          </button>
          <button type="button" disabled={status.type === 'loading'} onClick={handleVolverAPasoAnterior} className="w-full max-w-[400px] bg-white hover:bg-[#f8f9fa] text-[#333] border border-[#ccc] py-3.5 px-6 text-[14px] font-semibold rounded-md cursor-pointer transition-colors shadow-sm">
            REGRESAR PARA CORREGIR ALGÚN ERROR
          </button>
        </div>
      </div>
    );
  }

  // --- RENDERIZADO TITULO TOP BAR ---
  const extractTopBarHelpText = () => {
    if (currentStep === 1) return 'Paso 1: Datos Base y Categorías';

    const numeroPasosTotalesConfiguradosPorUsuario = fightFormsData.length;

    // Pantalla final añadida (Resumen)
    if (currentStep === numeroPasosTotalesConfiguradosPorUsuario + 2) return 'Paso Final: Verificación de Datos';

    // Es step dinámico (2, 3, etc)
    const numeroIndexCategoriaLlenando = currentStep - 1; // Base 1 context para usuario
    return `Etapa Formulario de Pelea: ${numeroIndexCategoriaLlenando} de ${numeroPasosTotalesConfiguradosPorUsuario}`;
  }

  // --- INYECTOR DE IMPRESIÓN (SOBREESCRIBE INTERFAZ SI ESTÁ ACTIVO) ---
  if (isPrintMode) {
    const flattenPeleas = [];
    fightFormsData.forEach((grupoCategoria) => {
      grupoCategoria.forEach((pelea, idx) => {
        flattenPeleas.push({ ...pelea, ordenEnCategoria: idx + 1 });
      });
    });

    const totalPaginas = Math.ceil(flattenPeleas.length / 9) || 1;
    const hojasHTML = [];

    const logo1UrlFinal = logoMode === 'cramm' ? '/logo_cramm.png' : (logoMode === 'url' ? logoUrlInput : (logoFile ? URL.createObjectURL(logoFile) : null));
    const logo2UrlFinal = logo2Mode === 'url' ? logo2UrlInput : (logo2File ? URL.createObjectURL(logo2File) : null);
    const watermarkUrlFinal = watermarkMode === 'cramm' ? '/logo_cramm.png' : (watermarkMode === 'url' ? watermarkUrlInput : (watermarkFile ? URL.createObjectURL(watermarkFile) : null));
    const hasLogos = logo1UrlFinal || logo2UrlFinal;

    // Función auxiliar para ajustar el tamaño de fuente según la longitud del texto
    const getAdjustedFontSize = (text, baseSize, threshold = 25, minSize = 6) => {
      if (!text) return `${baseSize}px`;
      if (text.length > threshold) {
        const factor = (text.length - threshold) * 0.15;
        const newSize = Math.max(minSize, baseSize - factor);
        return `${newSize}px`;
      }
      return `${baseSize}px`;
    };

    for (let i = 0; i < totalPaginas; i++) {
      const peleasPagina = flattenPeleas.slice(i * 9, (i + 1) * 9);

      hojasHTML.push(
        <div key={`pagina-${i}`} className="hoja-impresion-carta border border-[#ccc]">
          {Array.from({ length: 9 }).map((_, indexCelda) => {
            const pelea = peleasPagina[indexCelda] || { tipo_pelea: '', ordenEnCategoria: '', rojo_nombre: '', rojo_apellido: '', azul_nombre: '', azul_apellido: '' };
            return (
              <div key={`celda-${i}-${indexCelda}`} className={`w-full h-full flex flex-col text-[10px] font-sans box-border relative overflow-hidden bg-white ${printDesign === 3 ? 'border-[3px] border-black pt-1.5 px-1.5 pb-0 print:border-black'
                : 'border border-gray-400 pt-3 pb-2 px-3 print:border-[#111]'
                }`}>
                {watermarkUrlFinal && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.18] pointer-events-none z-[0]">
                    <img src={watermarkUrlFinal} alt="Watermark" className="max-w-[75%] max-h-[75%] object-contain mix-blend-multiply grayscale" />
                  </div>
                )}
                {/* SELECTOR MÚLTIPLE DE DISEÑOS */}
                {printDesign === 1 && (
                  <div className="w-full h-full flex flex-col">
                    {/* Cabecera Tarjeta */}
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="w-[40%] flex justify-left items-center h-12 mt-0.5 gap-2 pl-0.5">
                        {hasLogos ?
                          <>
                            {logo1UrlFinal && <img src={logo1UrlFinal} alt="Logo 1" className="max-h-full w-auto max-w-[48%] object-contain mix-blend-multiply opacity-90 scale-125 transform origin-left" />}
                            {logo2UrlFinal && <img src={logo2UrlFinal} alt="Logo 2" className="max-h-full w-auto max-w-[48%] object-contain mix-blend-multiply opacity-90 scale-125 transform origin-left" />}
                          </>
                          :
                          <div className="bg-gray-200 text-[#555] font-black text-[8px] flex items-center justify-center p-1 px-2 uppercase text-center rounded-[2px] w-full max-w-[50px] leading-tight">Logo<br />CRAMM</div>
                        }
                      </div>
                      <div className="w-[60%] text-right font-bold text-[#111] leading-tight flex flex-col items-end pt-0.5">
                        <span className="uppercase mb-0.5" style={{ fontSize: getAdjustedFontSize(formData.nombre_evento, 9, 20, 6.5) }}>{formData.nombre_evento} {formData.numero_evento ? ` ${formData.numero_evento}` : ''}</span>
                        <span className="uppercase" style={{ fontSize: '8px' }}>{formatFriendlyDate(formData.fecha)}</span>
                        <span className="uppercase" style={{ fontSize: getAdjustedFontSize(formData.ciudad, 8, 20, 6) }}>{formData.ciudad}</span>
                        <span className="uppercase" style={{ fontSize: '8px' }}>{pelea.tipo_pelea} {pelea.ordenEnCategoria}</span>
                      </div>
                    </div>

                    <div className="text-center font-black tracking-widest mb-1.5 mt-1 uppercase text-[#111] text-[12px]">{formData.disciplina || 'STRIKING'}</div>

                    {/* Nombres Box Clasico */}
                    <div className="flex justify-center items-center gap-1 w-full mb-1.5 px-1">
                      <div className="w-[45%] h-[20px] bg-white border border-red-600 flex items-center relative box-border print:border-red-600 print:-webkit-print-color-adjust: exact">
                        <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-red-600 print:bg-red-600"></div>
                        <div className="pl-4 pr-1 text-center font-bold uppercase text-[9px] truncate w-full whitespace-nowrap overflow-hidden text-black">
                          {pelea.rojo_apellido || '\u00A0'}
                        </div>
                      </div>
                      <div className="w-[10%] text-center text-[7px] font-black text-black">VS</div>
                      <div className="w-[45%] h-[20px] bg-white border border-blue-600 flex items-center relative box-border print:border-blue-600 print:-webkit-print-color-adjust: exact">
                        <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-blue-600 print:bg-blue-600"></div>
                        <div className="pr-4 pl-1 text-center font-bold uppercase text-[9px] truncate w-full whitespace-nowrap overflow-hidden text-black">
                          {pelea.azul_apellido || '\u00A0'}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 px-4 mt-1">
                      <div className="grid grid-cols-[1fr_30px_1fr] gap-2 items-center h-full pb-1">
                        <div className="flex flex-col gap-1.5 h-full pt-1">
                          <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                          <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                          <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                          <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                          <div className="border border-[#111] h-[18px] w-full mt-1.5 bg-white print:-webkit-print-color-adjust: exact"></div>
                        </div>
                        <div className="flex flex-col gap-1.5 font-black text-[8px] text-black text-center h-full pt-1 justify-start">
                          <div className="h-[18px] flex items-center justify-center">R1</div>
                          <div className="h-[18px] flex items-center justify-center">R2</div>
                          <div className="h-[18px] flex items-center justify-center">R3</div>
                          <div className="h-[18px] flex items-center justify-center">R4</div>
                          <div className="h-[18px] flex items-center justify-center mt-1.5 leading-none text-[6.5px]">TOTAL</div>
                        </div>
                        <div className="flex flex-col gap-1.5 h-full pt-1">
                          <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                          <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                          <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                          <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                          <div className="border border-[#111] h-[18px] w-full mt-1.5 bg-white print:-webkit-print-color-adjust: exact"></div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full mt-auto mb-0 flex flex-col justify-end">
                      <div className="flex justify-center gap-2 mb-6 mt-1">
                        <div className="border border-[#111] px-2 py-0.5 font-bold text-[8px] text-[#111] leading-none bg-white print:-webkit-print-color-adjust: exact">K.O</div>
                        <div className="border border-[#111] px-2 py-0.5 font-bold text-[8px] text-[#111] leading-none bg-white print:-webkit-print-color-adjust: exact">T.K.O</div>
                        <div className="border border-[#111] px-1.5 py-0.5 font-bold text-[8px] text-[#111] leading-none bg-white print:-webkit-print-color-adjust: exact">T.K.O.M</div>
                      </div>
                      <div className="font-extrabold text-[8px] text-black uppercase text-left ml-1 mt-1">NOMBRE DEL JUEZ</div>
                    </div>
                  </div>
                )}

                {/* DISEÑO 2: MINIMALISTA LÍNEAS */}
                {printDesign === 2 && (
                  <div className="w-full h-full flex flex-col px-1 justify-between pb-1">
                    <div>
                      <div className="flex justify-between items-center mb-0 border-b border-black pb-1.5">
                        <div className="w-[30%] flex gap-1.5 h-7">
                          {hasLogos ?
                            <>
                              {logo1UrlFinal && <img src={logo1UrlFinal} alt="Logo 1" className="h-full w-auto max-w-[48%] object-contain mix-blend-multiply opacity-80" />}
                              {logo2UrlFinal && <img src={logo2UrlFinal} alt="Logo 2" className="h-full w-auto max-w-[48%] object-contain mix-blend-multiply opacity-80" />}
                            </>
                            :
                            <div className="font-serif italic text-gray-400 text-[10px]">CRAMM</div>
                          }
                        </div>
                        <div className="w-[70%] text-right font-medium flex flex-col justify-end pt-1">
                          <div className="font-bold text-black uppercase tracking-wider mb-0.5" style={{ fontSize: getAdjustedFontSize(formData.nombre_evento, 8, 20, 6) }}>{formData.nombre_evento} {formData.numero_evento ? ` ${formData.numero_evento}` : ''}</div>
                          <div className="text-black tracking-widest uppercase" style={{ fontSize: getAdjustedFontSize(formData.ciudad, 7, 25, 5) }}>{formatFriendlyDate(formData.fecha)} | {formData.ciudad}</div>
                          <div className="text-[9px] text-[#333] tracking-widest uppercase mt-0.5 font-bold min-h-[14px]">
                            {pelea.tipo_pelea || pelea.ordenEnCategoria ? `${pelea.tipo_pelea} ${pelea.ordenEnCategoria}` : '\u00A0'}
                          </div>
                        </div>
                      </div>

                      <div className="text-center font-bold tracking-[0.2em] mb-1.5 mt-1.5 uppercase text-[#222] text-[12px]">
                        {formData.disciplina || 'STRIKING'}
                      </div>

                      <div className="w-full flex justify-between px-2 mb-1">
                        <div className="w-[45%] border-b-2 border-red-500 pb-0.5 text-center font-bold uppercase text-[9px] text-[#222] print:border-red-500 print:-webkit-print-color-adjust: exact overflow-hidden truncate min-h-[18px]">
                          {pelea.rojo_apellido || '\u00A0'}
                        </div>
                        <div className="w-[10%] text-center font-bold text-[7px] text-black self-end pb-0.5">vs</div>
                        <div className="w-[45%] border-b-2 border-blue-500 pb-0.5 text-center font-bold uppercase text-[9px] text-[#222] print:border-blue-500 print:-webkit-print-color-adjust: exact overflow-hidden truncate min-h-[18px]">
                          {pelea.azul_apellido || '\u00A0'}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 px-3 mt-2 mb-1 flex flex-col justify-center">
                      <div className="grid grid-cols-[1fr_30px_1fr] gap-x-3 gap-y-2.5 items-center">
                        <div className="flex flex-col gap-2.5 justify-center">
                          {['R1', 'R2', 'R3', 'R4', 'TOTAL'].map((r, i) => <div key={i} className={`border-b ${i === 4 ? 'border-[#000] border-b-2 mt-2' : 'border-black'} h-[14px] w-full`}></div>)}
                        </div>
                        <div className="flex flex-col gap-2.5 font-bold text-[8px] text-black text-center justify-center">
                          {['R1', 'R2', 'R3', 'R4', 'TOTAL'].map((r, i) => <div key={i} className={`h-[14px] flex items-end justify-center ${i === 4 ? 'mt-2 font-bold text-black text-[6.5px]' : ''}`}>{r}</div>)}
                        </div>
                        <div className="flex flex-col gap-2.5 justify-center">
                          {['R1', 'R2', 'R3', 'R4', 'TOTAL'].map((r, i) => <div key={i} className={`border-b ${i === 4 ? 'border-[#000] border-b-2 mt-2' : 'border-black'} h-[14px] w-full`}></div>)}
                        </div>
                      </div>
                    </div>

                    <div className="w-full mt-auto flex flex-col items-center">
                      <div className="flex gap-4 mb-6">
                        {['K.O', 'T.K.O', 'T.K.O.M'].map((x, i) => (
                          <div key={i} className="flex items-center gap-1"><div className="w-2h-[10px] rounded-sm border border-black h-2.5 w-2.5"></div><span className="text-[7px] text-black font-bold">{x}</span></div>
                        ))}
                      </div>
                      <div className="w-full px-2 mt-1">
                        <div className="border-b border-black w-full mb-1"></div>
                        <div className="font-bold text-[7px] text-black uppercase text-center tracking-widest">NOMBRE DEL JUEZ</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* DISEÑO 3: AGRESIVO / ESTILO MMA */}
                {printDesign === 3 && (
                  <div className="w-full h-full flex flex-col text-black print:-webkit-print-color-adjust: exact print:bg-white box-border justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1 border-b-[2px] border-black pb-1 pt-0.5">
                        <div className="w-[35%] flex justify-start items-center h-10 gap-2">
                          {hasLogos ?
                            <>
                              {logo1UrlFinal && <img src={logo1UrlFinal} alt="Logo 1" className="h-full w-auto max-w-[45%] object-contain object-left mix-blend-multiply opacity-100 scale-[1.10] origin-left" />}
                              {logo2UrlFinal && <img src={logo2UrlFinal} alt="Logo 2" className="h-full w-auto max-w-[45%] object-contain object-left mix-blend-multiply opacity-100 scale-[1.10] origin-left" />}
                            </>
                            :
                            <div className="font-black italic text-black text-[12px]">CRAMM</div>
                          }
                        </div>
                        <div className="text-right flex-1 flex flex-col items-end pt-0.5 justify-center">
                          <div className="font-black uppercase text-black leading-none mb-0.5" style={{ fontSize: getAdjustedFontSize(formData.nombre_evento, 8, 20, 6) }}>{formData.nombre_evento} {formData.numero_evento ? ` ${formData.numero_evento}` : ''}</div>
                          <div className="font-black uppercase text-[#d32f2f] tracking-tighter mix-blend-multiply mb-0.5 leading-none text-[12px] text-center w-full">
                            {formData.disciplina || 'STRIKING'}
                          </div>
                          <div className="text-black font-extrabold uppercase tracking-widest mb-0.5" style={{ fontSize: getAdjustedFontSize(formData.ciudad, 6, 25, 5) }}>
                            {formData.ciudad} - {formatFriendlyDate(formData.fecha)}
                          </div>
                          <div className="font-bold text-[6px] text-black uppercase tracking-widest bg-yellow-400 inline-flex items-center justify-center px-1.5 pt-px print:bg-yellow-400 print:-webkit-print-color-adjust: exact border border-black shadow-[1px_1px_0px_#000] h-[11px] min-w-[40px]">
                            {pelea.tipo_pelea || pelea.ordenEnCategoria ? `${pelea.tipo_pelea} ${pelea.ordenEnCategoria}` : '\u00A0'}
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full mt-1.5 justify-center gap-1.5">
                        <div className="w-[45%] bg-[#d32f2f] text-white px-0.5 py-1 text-center font-black uppercase text-[9px] tracking-wider truncate print:bg-[#d32f2f] print:-webkit-print-color-adjust: exact border-[2px] border-black print:border-black shadow-[1.5px_1.5px_0px_#000] min-h-[22px]">
                          {pelea.rojo_apellido || '\u00A0'}
                        </div>
                        <div className="w-[10%] text-center text-[8px] font-black text-black self-center italic leading-none pt-0.5">VS</div>
                        <div className="w-[45%] bg-[#1976d2] text-white px-0.5 py-1 text-center font-black uppercase text-[9px] tracking-wider truncate print:bg-[#1976d2] print:-webkit-print-color-adjust: exact border-[2px] border-black print:border-black shadow-[1.5px_1.5px_0px_#000] min-h-[22px]">
                          {pelea.azul_apellido || '\u00A0'}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 mt-2 flex flex-col justify-center gap-2 px-1">
                      {['R1', 'R2', 'R3', 'R4'].map((r, i) => (
                        <div key={i} className="grid grid-cols-[1fr_30px_1fr] gap-x-3 items-center">
                          <div className="border-[2px] border-black bg-white h-[18px] w-full shadow-[1.5px_1.5px_0px_#000] print:border-black print:-webkit-print-color-adjust: exact"></div>
                          <div className="h-[18px] bg-black text-white flex items-center justify-center rounded-sm text-[9px] font-black print:bg-black print:text-white print:-webkit-print-color-adjust: exact tracking-tighter">{r}</div>
                          <div className="border-[2px] border-black bg-white h-[18px] w-full shadow-[1.5px_1.5px_0px_#000] print:border-black print:-webkit-print-color-adjust: exact"></div>
                        </div>
                      ))}
                      <div className="grid grid-cols-[1fr_30px_1fr] gap-x-3 items-center mt-1">
                        <div className="border-[2px] border-black bg-white h-[18px] w-full shadow-[2.5px_2.5px_0px_#000] print:border-black print:-webkit-print-color-adjust: exact"></div>
                        <div className="h-[18px] bg-black text-white flex items-center justify-center rounded-sm text-[5px] font-black leading-none print:bg-black print:text-white print:-webkit-print-color-adjust: exact px-px">TOTAL</div>
                        <div className="border-[2px] border-black bg-white h-[18px] w-full shadow-[2.5px_2.5px_0px_#000] print:border-black print:-webkit-print-color-adjust: exact"></div>
                      </div>
                    </div>

                    <div className="w-[calc(100%+12px)] mt-auto mx-[-6px] flex flex-col px-3 border-t-[2px] border-black pt-2 pb-1.5 bg-gray-50 print:bg-gray-50 print:-webkit-print-color-adjust: exact">
                      <div className="flex gap-2 w-full justify-center mb-6">
                        {['K.O', 'T.K.O', 'T.K.O.M'].map((x, i) => (
                          <div key={i} className="bg-white border-2 border-black px-1.5 py-0.5 font-black text-[7px] text-black shadow-[1.5px_1.5px_0px_#000] print:-webkit-print-color-adjust: exact">{x}</div>
                        ))}
                      </div>
                      <div className="w-full flex justify-between items-end px-1 mt-0.5">
                        <div className="font-extrabold text-[7px] text-black uppercase">NOMBRE DEL JUEZ</div>
                        <div className="border-b-[2px] border-black w-28 border-solid"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div className="impresion-preview-wrapper bg-gray-500 font-sans min-h-screen print:bg-white print:min-h-0 print:p-0">
        <div className="no-print fixed top-0 left-0 right-0 bg-gray-800 text-white flex flex-col z-50 shadow-md">
          <div className="flex justify-between items-center p-3 border-b border-gray-700">
            <div>
              <h2 className="m-0 text-md font-bold ml-2">Vista Previa de Impresión</h2>
              <p className="text-xs text-gray-400 ml-2 mt-0.5 text-ellipsis max-w-[400px] whitespace-nowrap overflow-hidden">
                Escoge el diseño deseado. Asegúrate de desactivar "Márgenes" en el menú de impresión y activar "Gráficos de Fondo".
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => setIsPrintMode(false)} className="bg-gray-600 hover:bg-gray-500 px-5 py-2 rounded text-sm font-bold text-white transition-colors cursor-pointer border-none">Volver</button>
              <button onClick={() => window.print()} className="bg-[#b91d22] hover:bg-[#a0181d] px-6 py-2 rounded text-sm font-bold text-white transition-colors shadow-lg cursor-pointer border-none flex items-center gap-2"><span className="material-symbols-outlined text-base">print</span> IMPRIMIR AHORA</button>
            </div>
          </div>

          {/* Opciones de Plantilla */}
          <div className="bg-gray-900 py-2.5 px-5 flex justify-center items-center gap-6 shadow-inner">
            <span className="font-bold text-xs text-gray-400 uppercase tracking-widest">Modelo de Hoja:</span>

            <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors group">
              <input type="radio" value={1} checked={printDesign === 1} onChange={() => setPrintDesign(1)} className="w-4 h-4 accent-red-500 cursor-pointer" />
              <span className={`text-sm font-semibold transition-colors ${printDesign === 1 ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>1. Clásico</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors group">
              <input type="radio" value={2} checked={printDesign === 2} onChange={() => setPrintDesign(2)} className="w-4 h-4 accent-red-500 cursor-pointer" />
              <span className={`text-sm font-semibold transition-colors ${printDesign === 2 ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>2. Premium Minimalista</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors group">
              <input type="radio" value={3} checked={printDesign === 3} onChange={() => setPrintDesign(3)} className="w-4 h-4 accent-red-500 cursor-pointer" />
              <span className={`text-sm font-semibold transition-colors ${printDesign === 3 ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>3. Agresivo Oscuro</span>
            </label>
          </div>
        </div>
        <div className="pt-32 pb-10 print:p-0 print:m-0">
          {hojasHTML}
        </div>
      </div>
    );
  }

  if (isChecklistMode) {
    const logo1UrlFinal = logoMode === 'cramm' ? '/logo_cramm.png' : (logoMode === 'url' ? logoUrlInput : (logoFile ? URL.createObjectURL(logoFile) : null));
    const logo2UrlFinal = logo2Mode === 'url' ? logo2UrlInput : (logo2File ? URL.createObjectURL(logo2File) : null);

    const flattenPeleas = [];
    fightFormsData.forEach((grupoCategoria) => {
      grupoCategoria.forEach((pelea, idx) => {
        flattenPeleas.push({ ...pelea, ordenEnCategoria: idx + 1 });
      });
    });

    const checkItems = [
      { label: 'Revisión de Pies y Manos', required: true },
      { label: 'Vendaje', required: true },
      { label: 'Equipo de Protección', required: false },
    ];

    // Agrupar en bloques de 7 para paginación
    const peleasPorPagina = 7;
    const paginas = [];
    for (let i = 0; i < flattenPeleas.length; i += peleasPorPagina) {
      paginas.push(flattenPeleas.slice(i, i + peleasPorPagina));
    }

    return (
      <div className="bg-gray-100 min-h-screen print:bg-white print:p-0">
        {/* Nav Bar */}
        <div className="no-print fixed top-0 left-0 right-0 bg-[#1a1a1a] text-white flex flex-col sm:flex-row justify-between items-center p-3 sm:p-4 z-[100] shadow-lg border-b border-red-600 gap-3">
          <h2 className="m-0 font-black text-sm sm:text-lg tracking-widest text-red-500 uppercase text-center sm:text-left truncate w-full sm:w-auto">Lista de Chequeo</h2>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto justify-center">
            <button onClick={() => setIsChecklistMode(false)} className="bg-gray-700 hover:bg-gray-600 px-4 sm:px-5 py-2 rounded font-bold transition-all text-[11px] sm:text-sm uppercase cursor-pointer border-none text-white whitespace-nowrap">← Volver</button>
            <button onClick={() => window.print()} className="bg-red-600 hover:bg-red-700 px-5 sm:px-6 py-2 rounded font-black text-white shadow-[0_3px_0_#991b1b] active:translate-y-px active:shadow-none transition-all flex items-center gap-2 text-[11px] sm:text-sm uppercase cursor-pointer border-none whitespace-nowrap">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">print</span> Imprimir
            </button>
          </div>
        </div>

        <div className="pt-24 pb-10 px-4 max-w-5xl mx-auto print:pt-6 print:pb-0 print:max-w-none">
          {paginas.map((grupo, pIdx) => (
            <div key={`page-${pIdx}`} className={`${pIdx > 0 ? 'print:pt-8' : ''} ${pIdx < paginas.length - 1 ? 'print:page-break-after-always mb-12 print:mb-0' : ''}`}>
              {/* Header imprimible - Se repite en cada página */}
              <div className="bg-white border-2 border-black p-5 mb-6 rounded-md shadow-sm flex items-center justify-between">
                <div className="w-[110px] h-[85px] flex items-center justify-center">
                  {logo1UrlFinal && <img src={logo1UrlFinal} alt="L1" className="max-h-full max-w-full object-contain" />}
                </div>
                <div className="text-center">
                  <h1 className="text-xl font-black text-black uppercase mb-1">{formData.nombre_evento} {formData.numero_evento ? `#${formData.numero_evento}` : ''}</h1>
                  <p className="text-sm font-bold text-gray-600 uppercase tracking-widest">{formatFriendlyDate(formData.fecha)} | {formData.ciudad}</p>
                  <div className="mt-2 text-[11px] font-black text-red-600 border border-red-600 inline-block px-4 py-1 rounded-sm uppercase">
                    Lista de Chequeo de Peleadores {paginas.length > 1 ? `(Pág. ${pIdx + 1}/${paginas.length})` : ''}
                  </div>
                </div>
                <div className="w-[110px] h-[85px] flex items-center justify-center">
                  {logo2UrlFinal && <img src={logo2UrlFinal} alt="L2" className="max-h-full max-w-full object-contain" />}
                </div>
              </div>

              {/* Grid de tarjetas por pelea */}
              <div className="flex flex-col gap-2">
                {grupo.map((pelea, idxInGroup) => {
                  const globalIdx = pIdx * peleasPorPagina + idxInGroup;
                  return (
                    <div key={`checklist-${globalIdx}`} className="bg-white border-2 border-black rounded-sm overflow-hidden">
                      {/* Header pelea */}
                      <div className="bg-black text-white px-4 py-1.5 flex justify-between items-center">
                        <span className="font-bold text-[12px] sm:text-[13px] uppercase tracking-wider truncate mr-2">{pelea.tipo_pelea}</span>
                        <span className="bg-red-600 px-2 py-0.5 text-[10px] sm:text-[11px] font-black italic whitespace-nowrap">PELEA #{globalIdx + 1}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-black">
                        {/* Esquina Roja */}
                        <div className="p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 bg-red-600 rounded-sm shrink-0"></div>
                            <span className="font-black text-[13px] text-red-700 uppercase truncate">{pelea.rojo_nombre} {pelea.rojo_apellido}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {checkItems.map((item) => (
                              <div key={item.label} className="flex items-center gap-2.5">
                                <div className="w-5 h-5 border-2 border-gray-500 rounded-sm shrink-0"></div>
                                <span className="text-[10px] font-bold uppercase text-gray-700">
                                  {item.label}
                                  {!item.required && <span className="text-gray-400 normal-case font-normal ml-1">(opcional)</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Esquina Azul */}
                        <div className="p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 bg-blue-600 rounded-sm shrink-0"></div>
                            <span className="font-black text-[13px] text-blue-700 uppercase truncate">{pelea.azul_nombre} {pelea.azul_apellido}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {checkItems.map((item) => (
                              <div key={item.label} className="flex items-center gap-2.5">
                                <div className="w-5 h-5 border-2 border-gray-500 rounded-sm shrink-0"></div>
                                <span className="text-[10px] font-bold uppercase text-gray-700">
                                  {item.label}
                                  {!item.required && <span className="text-gray-400 normal-case font-normal ml-1">(opcional)</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isControlMode) {
    const logo1UrlFinal = logoMode === 'cramm' ? '/logo_cramm.png' : (logoMode === 'url' ? logoUrlInput : (logoFile ? URL.createObjectURL(logoFile) : null));
    const logo2UrlFinal = logo2Mode === 'url' ? logo2UrlInput : (logo2File ? URL.createObjectURL(logo2File) : null);
    const watermarkUrlFinal = watermarkMode === 'cramm' ? '/logo_cramm.png' : (watermarkMode === 'url' ? watermarkUrlInput : (watermarkFile ? URL.createObjectURL(watermarkFile) : null));

    const flattenPeleas = [];
    fightFormsData.forEach((grupoCategoria) => {
      grupoCategoria.forEach((pelea, idx) => {
        flattenPeleas.push({ ...pelea, ordenEnCategoria: idx + 1 });
      });
    });

    return (
      <div className="control-mode-wrapper bg-gray-100 min-h-screen print:bg-white print:p-0">
        <div className="no-print fixed top-0 left-0 right-0 bg-[#1a1a1a] text-white flex flex-col sm:flex-row justify-between items-center p-3 sm:p-4 z-[100] shadow-lg border-b border-red-600 gap-3">
          <h2 className="m-0 font-black text-sm sm:text-lg tracking-widest text-red-500 uppercase text-center sm:text-left truncate w-full sm:w-auto">Hoja de Control de Resultados</h2>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto justify-center">
            <button onClick={() => setIsControlMode(false)} className="bg-gray-700 hover:bg-gray-600 px-4 sm:px-5 py-2 rounded font-bold transition-all text-[11px] sm:text-sm uppercase cursor-pointer border-none text-white whitespace-nowrap">← Volver</button>
            <button onClick={() => window.print()} className="bg-red-600 hover:bg-red-700 px-5 sm:px-6 py-2 rounded font-black text-white shadow-[0_3px_0_#991b1b] active:translate-y-px active:shadow-none transition-all flex items-center gap-2 text-[11px] sm:text-sm uppercase cursor-pointer border-none whitespace-nowrap"><span className="material-symbols-outlined text-[16px] sm:text-[18px]">print</span> Imprimir Lista</button>
          </div>
        </div>

        <div className="pt-24 pb-10 px-4 max-w-5xl mx-auto print:pt-0 print:pb-0 print:max-w-none">
          {/* Header Imprimible */}
          <div className="bg-white border-2 border-black p-6 mb-6 rounded-md shadow-sm flex items-center justify-between">
            <div className="w-[130px] h-[100px] flex items-center justify-center">
              {logo1UrlFinal && <img src={logo1UrlFinal} alt="Logo 1" className="max-h-full max-w-full object-contain" />}
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-black uppercase mb-1">{formData.nombre_evento} {formData.numero_evento ? `#${formData.numero_evento}` : ''}</h1>
              <p className="text-sm font-bold text-gray-600 uppercase tracking-widest">{formatFriendlyDate(formData.fecha)} | {formData.ciudad} | {formData.disciplina}</p>
              <div className="mt-2 text-[11px] font-black text-red-600 border border-red-600 inline-block px-4 py-1 rounded-sm uppercase">Control de Resultados</div>
            </div>
            <div className="w-[130px] h-[100px] flex items-center justify-center">
              {logo2UrlFinal && <img src={logo2UrlFinal} alt="Logo 2" className="max-h-full max-w-full object-contain" />}
            </div>
          </div>

          {/* Grid de Tarjetas de Peleas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
            {flattenPeleas.map((pelea, idx) => (
              <div key={`control-card-${idx}`} className="bg-white border-2 border-black rounded-sm overflow-hidden flex flex-col relative h-[300px] print:h-[280px]">
                {/* Background Watermark for Control Sheet too */}
                {watermarkUrlFinal && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none z-0 grayscale">
                    <img src={watermarkUrlFinal} alt="W" className="max-w-[60%] max-h-[60%] object-contain" />
                  </div>
                )}

                {/* Top Section: Category and Number */}
                <div className="bg-black text-white p-2 flex justify-between items-center z-10">
                  <span className="font-bold text-[13px] uppercase tracking-wider">{pelea.tipo_pelea}</span>
                  <span className="bg-red-600 px-2 py-0.5 text-[11px] font-black italic">PELEA #{idx + 1}</span>
                </div>

                <div className="p-4 flex flex-col flex-1 z-10">
                  {/* Fighters Section */}
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 bg-red-50 border border-red-200 p-2 rounded text-center relative">
                      <span className="absolute -top-2 left-2 bg-red-600 text-white text-[8px] font-bold px-1 px-1 rounded uppercase">Rojo</span>
                      <div className="font-black text-[14px] text-red-700 uppercase mt-1 truncate">{pelea.rojo_apellido}</div>
                      {pelea.rojo_apodo && <div className="text-[9px] text-gray-500 italic mt-0.5">"{pelea.rojo_apodo}"</div>}
                    </div>
                    <div className="flex items-center text-xs font-black text-gray-400 italic">VS</div>
                    <div className="flex-1 bg-blue-50 border border-blue-200 p-2 rounded text-center relative">
                      <span className="absolute -top-2 right-2 bg-blue-600 text-white text-[8px] font-bold px-1 px-1 rounded uppercase">Azul</span>
                      <div className="font-black text-[14px] text-blue-700 uppercase mt-1 truncate">{pelea.azul_apellido}</div>
                      {pelea.azul_apodo && <div className="text-[9px] text-gray-500 italic mt-0.5">"{pelea.azul_apodo}"</div>}
                    </div>
                  </div>

                  {/* Annotation Area */}
                  <div className="grid grid-cols-2 gap-4 flex-1">
                    {/* Ganador */}
                    <div className="border border-dashed border-gray-400 p-2 rounded flex flex-col justify-center">
                      <div className="text-[10px] font-black uppercase text-gray-500 mb-2">Ganador:</div>
                      <div className="flex justify-around items-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-6 h-6 border-2 border-red-600 rounded-full"></div>
                          <span className="text-[8px] font-bold uppercase text-red-600">Rojo</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-6 h-6 border-2 border-blue-600 rounded-full"></div>
                          <span className="text-[8px] font-bold uppercase text-blue-600">Azul</span>
                        </div>
                      </div>
                    </div>
                    {/* Método y Round */}
                    <div className="flex flex-col gap-2">
                      <div className="border border-dashed border-gray-400 p-2 rounded grid grid-cols-2 gap-x-3 gap-y-1.5">
                        {['K.O', 'T.K.O', 'Decisión Unánime', 'Decisión Dividida'].map(m => (
                          <div key={m} className="flex items-center gap-2">
                            <div className="w-4 h-4 border border-gray-600 shrink-0"></div>
                            <span className="text-[8px] font-bold uppercase leading-tight">{m}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border border-dashed border-gray-400 p-2 rounded flex flex-col justify-center">
                        <div className="text-[9px] font-black text-gray-400 flex flex-col gap-1.5 uppercase">
                          <div className="flex justify-between items-end">Round: <div className="border-b border-gray-400 w-12 pb-px"></div></div>
                          <div className="flex justify-between items-end">Tiempo: <div className="border-b border-gray-400 w-16 pb-px"></div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Signature */}
                <div className="border-t border-black p-1 text-center bg-gray-50">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Firma de Oficial / Supervisor</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (isResultMode) {
    const logo1UrlFinal = logoMode === 'cramm' ? '/logo_cramm.png' : (logoMode === 'url' ? logoUrlInput : (logoFile ? URL.createObjectURL(logoFile) : null));
    const logo2UrlFinal = logo2Mode === 'url' ? logo2UrlInput : (logo2File ? URL.createObjectURL(logo2File) : null);
    const watermarkUrlFinal = watermarkMode === 'cramm' ? '/logo_cramm.png' : (watermarkMode === 'url' ? watermarkUrlInput : (watermarkFile ? URL.createObjectURL(watermarkFile) : null));
    const flattenPeleas = [];
    fightFormsData.forEach((grupoCategoria) => {
      grupoCategoria.forEach((pelea) => {
        flattenPeleas.push(pelea);
      });
    });

    const totalPaginas = Math.ceil(flattenPeleas.length / 2) || 1;
    const hojasHTML = [];

    for (let i = 0; i < totalPaginas; i++) {
      const peleasPagina = flattenPeleas.slice(i * 2, (i + 1) * 2);
      // Rellenar con nulls si solo hay 1 pelea en la página
      while (peleasPagina.length < 2) peleasPagina.push(null);

      hojasHTML.push(
        <div key={`pagina-res-${i}`} className="hoja-resultado-carta">
          {peleasPagina.map((pelea, idx) => (
            <div key={`result-card-${i}-${idx}`} style={{ flex: '1', border: '4px solid black', padding: '20px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', background: 'white', position: 'relative' }}>
              {pelea ? (
                <>
                  {/* WATERMARK BACKGROUND */}
                  {watermarkUrlFinal && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.18, pointerEvents: 'none', zIndex: 0 }}>
                      <img src={watermarkUrlFinal} alt="Watermark" style={{ maxWidth: '75%', maxHeight: '75%', objectFit: 'contain', filter: 'grayscale(100%)' }} />
                    </div>
                  )}
                  {/* TÍTULO Y LOGOS */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', gap: '20px', position: 'relative' }}>
                    {/* Logo Izquierdo */}
                    <div style={{ width: '100px', height: '75px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {logo1UrlFinal && <img src={logo1UrlFinal} alt="Logo 1" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />}
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '900', textTransform: 'uppercase', textDecoration: 'underline', letterSpacing: '0.2em', lineHeight: '1.2' }}>TARJETA DE RESULTADO</div>
                      <div style={{ fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.3em', marginTop: '4px' }}>"VENCEDOR"</div>
                    </div>

                    {/* Logo Derecho */}
                    <div style={{ width: '100px', height: '75px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {logo2UrlFinal && <img src={logo2UrlFinal} alt="Logo 2" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />}
                    </div>
                  </div>

                  {/* TIEMPO Y ROUND */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', padding: '0 20px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{ fontWeight: '900', fontSize: '13px', whiteSpace: 'nowrap' }}>TIEMPO:</span>
                      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid black', paddingBottom: '2px', minWidth: '140px', justifyContent: 'center', fontSize: '10px', color: '#888' }}>
                        <span>min</span>
                        <span style={{ color: 'black' }}>/</span>
                        <span>seg</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{ fontWeight: '900', fontSize: '13px', whiteSpace: 'nowrap' }}>ROUND:</span>
                      <div style={{ borderBottom: '2px solid black', width: '100px', height: '20px' }}></div>
                    </div>
                  </div>

                  {/* COLUMNAS PRINCIPALES */}
                  <div style={{ display: 'flex', flex: '1', position: 'relative', borderTop: '2px solid black', paddingTop: '16px' }}>
                    {/* LÍNEA DIVISORIA CENTRAL */}
                    <div style={{ position: 'absolute', left: '50%', top: '0', bottom: '0', width: '3px', background: 'black', transform: 'translateX(-50%)' }}></div>

                    {/* COLUMNA IZQUIERDA - ESQUINA ROJA */}
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: '30px', gap: '10px' }}>
                      <div style={{ fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>K.O.</div>
                      <div style={{ fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>Decisión Unánime</div>

                      <div style={{ width: '100%', border: '3px solid #e74c3c', padding: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginTop: '10px' }}>
                        <span style={{ color: '#e74c3c', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px', borderBottom: '1px solid #fca5a5', paddingBottom: '4px', width: '100%' }}>Esquina Roja</span>
                        <div style={{ fontWeight: '900', fontSize: '15px', textTransform: 'uppercase', lineHeight: '1.4', color: 'black' }}>
                          {pelea.rojo_nombre}{' '}
                          {pelea.rojo_apodo ? <em>"{pelea.rojo_apodo}"</em> : null}{' '}
                          {pelea.rojo_apellido}
                        </div>
                      </div>
                    </div>

                    {/* COLUMNA DERECHA - ESQUINA AZUL */}
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: '30px', gap: '10px' }}>
                      <div style={{ fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>K.O. Técnico (T.K.O)</div>
                      <div style={{ fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>Decisión Dividida</div>

                      <div style={{ width: '100%', border: '3px solid #3498db', padding: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginTop: '10px' }}>
                        <span style={{ color: '#3498db', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px', borderBottom: '1px solid #93c5fd', paddingBottom: '4px', width: '100%' }}>Esquina Azul</span>
                        <div style={{ fontWeight: '900', fontSize: '15px', textTransform: 'uppercase', lineHeight: '1.4', color: 'black' }}>
                          {pelea.azul_nombre}{' '}
                          {pelea.azul_apodo ? <em>"{pelea.azul_apodo}"</em> : null}{' '}
                          {pelea.azul_apellido}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ flex: '1' }}></div>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="resultado-wrapper bg-[#1a1a1a] min-h-screen">
        <div className="no-print fixed top-0 left-0 right-0 bg-[#222] text-white p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-center z-50 border-b border-black shadow-[0_4px_12px_rgba(0,0,0,0.4)] gap-3">
          <h2 className="m-0 text-[14px] sm:text-[18px] font-black tracking-widest text-[#ef4444] uppercase text-center sm:text-left">Tarjetas de Resultado</h2>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto justify-center">
            <button onClick={() => setIsResultMode(false)} className="bg-[#444] border-none text-white px-4 sm:px-5 py-2 rounded-md font-bold cursor-pointer uppercase tracking-wider text-[11px] sm:text-[13px] whitespace-nowrap">
              ← Regresar
            </button>
            <button onClick={() => window.print()} className="bg-[#dc2626] border-none text-white px-6 sm:px-8 py-2 rounded-md font-black cursor-pointer uppercase tracking-wider text-[11px] sm:text-[13px] shadow-[0_4px_0_#991b1b] flex items-center justify-center gap-2 whitespace-nowrap">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">print</span> Imprimir Ahora
            </button>
          </div>
        </div>
        <div className="resultado-content" style={{ paddingTop: '100px', paddingBottom: '40px' }}>
          {hojasHTML}
        </div>
      </div>
    )
  }

  // --- RENDER PRINCIPAL APP ---
  return (
    <div className="flex justify-center items-start min-h-screen pt-0 sm:pt-10 pb-0 sm:pb-10 bg-[#eef1f5] no-print">
      <div className={`w-full bg-white rounded-none sm:rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden font-sans transition-all duration-300 ${currentStep === 1 ? 'max-w-[700px]' : 'max-w-[850px]'}`}>

        <div className={currentStep === 1 ? "bg-[#b91d22] text-white text-center py-6 px-5" : "bg-[#6c7b95] text-white text-center py-5 px-5"}>
          <h1 className="m-0 text-[26px] font-bold tracking-wide">Generador de Tarjetas</h1>
          <p className="mt-2 text-sm opacity-90 font-medium tracking-wide shadow-sm">
            {extractTopBarHelpText()}
          </p>
        </div>

        {status.message && (
          <div className={`p-4 text-center text-sm font-bold text-white shadow-inner ${status.type === 'success' ? 'bg-green-500' :
            status.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }`}>
            {status.message}
          </div>
        )}
        {/* PANTALLA EXCLUSIVA DE ÉXITO PERMANENTE */}
        {isSuccess && (
          <div className="p-10 text-center py-16 bg-white flex flex-col items-center">
            <div className="w-20 h-20 bg-[#f0f9f3] text-green-600 rounded-full flex items-center justify-center mb-6 text-3xl font-black border border-green-200">✓</div>
            <h2 className="text-2xl font-black text-[#111] mb-2 uppercase">¡Registro Terminado!</h2>
            <p className="text-gray-500 mb-10 max-w-sm">Ahora puedes generar las Tarjetas de Jueces y Control para este evento.</p>

            <div className="flex flex-col gap-4 items-center w-full max-w-[350px]">
              <button type="button" onClick={() => setIsPrintMode(true)} className="w-full bg-[#3a475a] hover:bg-[#2a3442] border-none text-white py-4 font-bold rounded-md uppercase tracking-wider text-[13px] transition-colors shadow-sm cursor-pointer">
                <div className="flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[18px]">print</span> Generar Tarjetas de Jueces</div>
              </button>
              <button type="button" onClick={() => setIsResultMode(true)} className="w-full bg-[#b91d22] hover:bg-[#96181b] border-none text-white py-4 font-bold rounded-md uppercase tracking-wider text-[13px] transition-colors shadow-[0_4px_0_rgb(130,20,24)] active:translate-y-1 active:shadow-none cursor-pointer">
                <div className="flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[18px]">emoji_events</span> Generar Tarjetas de Resultados</div>
              </button>
              <button type="button" onClick={() => setIsControlMode(true)} className="w-full bg-[#1a1a1a] hover:bg-black border-none text-white py-4 font-bold rounded-md uppercase tracking-wider text-[13px] transition-colors shadow-[0_4px_0_#444] active:translate-y-1 active:shadow-none cursor-pointer">
                <div className="flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[18px]">fact_check</span> Generar Control de Resultados</div>
              </button>
              <button type="button" onClick={() => setIsChecklistMode(true)} className="w-full bg-[#2d6a4f] hover:bg-[#1b4332] border-none text-white py-4 font-bold rounded-md uppercase tracking-wider text-[13px] transition-colors shadow-[0_4px_0_#1b4332] active:translate-y-1 active:shadow-none cursor-pointer">
                <div className="flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[18px]">checklist</span> Generar Lista de Chequeo</div>
              </button>
              <button type="button" onClick={resetFormulario} className="w-full bg-white border border-[#ccc] hover:bg-gray-50 text-[#333] py-4 font-bold rounded-md uppercase tracking-wider text-[13px] transition-colors cursor-pointer">
                <div className="flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[18px]">add</span> Crear un Evento Nuevo</div>
              </button>
            </div>
          </div>
        )}
        {/* STEP 1: FORMULARIO DEL EVENTO Y SU GENERADOR DE CATEGORIAS */}
        {!isSuccess && currentStep === 1 && (
          <form className="p-5 sm:p-8 sm:px-10" onSubmit={proceedFromStep1} autoComplete="off" noValidate>

            {/* COMPACTAMOS EVENTO Y CIUDAD ARRIBA */}
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-6">

              <div>
                <label className="block text-sm font-bold text-[#111] mb-2 uppercase tracking-wide">Nombre del Evento *</label>
                {isAddingNombre ? (
                  <div className="flex items-center gap-1">
                    <input type="text" value={nuevoNombreInput} onChange={(e) => setNuevoNombreInput(e.target.value)} placeholder="Ej. Budo Strike..." className="flex-grow p-2.5 text-sm border border-[#e1e8f0] rounded focus:outline-none" autoFocus autoComplete="off" />
                    <button type="button" onClick={handleSaveNuevoNombre} className="bg-green-600 hover:bg-green-700 text-white w-[42px] h-[42px] rounded flex justify-center items-center transition-colors"><span className="material-symbols-outlined text-[20px]">check</span></button>
                    <button type="button" onClick={() => { setIsAddingNombre(false); setNuevoNombreInput(''); }} className="bg-gray-500 hover:bg-gray-600 text-white w-[42px] h-[42px] rounded flex justify-center items-center transition-colors"><span className="material-symbols-outlined text-[20px]">close</span></button>
                  </div>
                ) : isDeletingNombre ? (
                  <div className="flex flex-col bg-white border border-red-400 rounded-md max-h-40 relative">
                    <div className="bg-red-50 p-2 border-b border-red-200 flex justify-between items-center text-xs text-red-700 font-bold"><span>Hacer clic para borrar:</span> <button type="button" onClick={() => setIsDeletingNombre(false)} className="flex items-center"><span className="material-symbols-outlined text-[16px]">close</span></button> </div>
                    <div className="overflow-y-auto w-full">
                      {nombresEventos.map((n) => (<button key={n.id} type="button" onClick={() => executeDeleteNombre(n.nombre)} className="w-full text-left p-2 hover:bg-red-100 border-b border-gray-100 last:border-0 cursor-pointer text-sm flex items-center justify-between"><span className="flex-1">{n.nombre}</span><span className="material-symbols-outlined text-[16px] text-red-500">close</span></button>))}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1 h-[42px] relative">
                    <select id="input-nombre_evento" name="nombre_evento" value={formData.nombre_evento} onChange={handleChange1} className={`flex-1 min-w-0 p-2.5 text-sm border rounded bg-white text-[#333] cursor-pointer ${formErrors.includes('nombre_evento') ? 'border-red-500 ring-1 ring-red-500' : 'border-[#e1e8f0]'}`} required>
                      <option value="" disabled hidden>Seleccione evento</option>
                      {nombresEventos.map((n) => (<option key={n.id} value={n.nombre}>{n.nombre}</option>))}
                    </select>
                    {tooltipField === 'nombre_evento' && <ValidationTooltip message="Completa este campo" />}
                    <button type="button" onClick={() => { setIsAddingNombre(true); setIsDeletingNombre(false); }} className="w-[42px] bg-white border border-[#e1e8f0] rounded text-[#333] flex justify-center items-center text-lg hover:bg-gray-50">+</button>
                    <button type="button" onClick={() => setIsDeletingNombre(true)} className="w-[42px] bg-white border border-[#e1e8f0] rounded text-red-500 flex justify-center items-center hover:bg-red-50"><span className="material-symbols-outlined text-xl">delete</span></button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-[#111] mb-2 uppercase tracking-wide">Sede *</label>
                {isAddingCiudad ? (
                  <div className="flex items-center gap-1">
                    <input type="text" value={nuevaCiudadInput} onChange={(e) => setNuevaCiudadInput(e.target.value)} placeholder="Agregar Sede" className="flex-grow p-2.5 text-sm border border-[#e1e8f0] rounded focus:outline-none" autoFocus autoComplete="off" />
                    <button type="button" onClick={handleSaveNuevaCiudad} className="bg-green-600 hover:bg-green-700 text-white w-[42px] h-[42px] rounded flex justify-center items-center transition-colors"><span className="material-symbols-outlined text-[20px]">check</span></button>
                    <button type="button" onClick={() => { setIsAddingCiudad(false); setNuevaCiudadInput(''); }} className="bg-gray-500 hover:bg-gray-600 text-white w-[42px] h-[42px] rounded flex justify-center items-center transition-colors"><span className="material-symbols-outlined text-[20px]">close</span></button>
                  </div>
                ) : isDeletingCiudad ? (
                  <div className="flex flex-col bg-white border border-red-400 rounded-md max-h-40 relative">
                    <div className="bg-red-50 p-2 border-b border-red-200 flex justify-between items-center text-xs text-red-700 font-bold"><span>Hacer clic para borrar:</span> <button type="button" onClick={() => setIsDeletingCiudad(false)} className="flex items-center"><span className="material-symbols-outlined text-[16px]">close</span></button> </div>
                    <div className="overflow-y-auto w-full">
                      {ciudades.map((c) => (<button key={c.id} type="button" onClick={() => executeDeleteCiudad(c.nombre)} className="w-full text-left p-2 hover:bg-red-100 border-b border-gray-100 last:border-0 cursor-pointer text-sm flex items-center justify-between"><span className="flex-1">{c.nombre}</span><span className="material-symbols-outlined text-[16px] text-red-500">close</span></button>))}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1 h-[42px] relative">
                    <select id="input-ciudad" name="ciudad" value={formData.ciudad} onChange={handleChange1} className={`flex-1 min-w-0 p-2.5 text-sm border rounded bg-white text-[#333] cursor-pointer ${formErrors.includes('ciudad') ? 'border-red-500 ring-1 ring-red-500' : 'border-[#e1e8f0]'}`} required>
                      <option value="" disabled hidden>Seleccione sede</option>
                      {ciudades.map((c) => (<option key={c.id} value={c.nombre}>{c.nombre}</option>))}
                    </select>
                    {tooltipField === 'ciudad' && <ValidationTooltip message="Completa este campo" />}
                    <button type="button" onClick={() => { setIsAddingCiudad(true); setIsDeletingCiudad(false); }} className="w-[42px] bg-white border border-[#e1e8f0] rounded text-[#333] flex justify-center items-center text-lg hover:bg-gray-50">+</button>
                    <button type="button" onClick={() => setIsDeletingCiudad(true)} className="w-[42px] bg-white border border-[#e1e8f0] rounded text-red-500 flex justify-center items-center hover:bg-red-50"><span className="material-symbols-outlined text-xl">delete</span></button>
                  </div>
                )}
              </div>

            </div>

            <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[#111] mb-2">Número de Evento</label>
                <input name="numero_evento" value={formData.numero_evento} onChange={handleChange1} type="number" placeholder="Ej. 12" className="w-full p-2.5 text-sm border border-[#e1e8f0] rounded bg-white" min="0" autoComplete="off" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#111] mb-2 uppercase tracking-wide">Disciplina *</label>
                <div className="relative">
                  <input id="input-disciplina" name="disciplina" value={formData.disciplina} onChange={handleChange1} type="text" placeholder="Ej. BOX, MMA, KARATE" className={`w-full p-2.5 text-sm border rounded bg-white uppercase ${formErrors.includes('disciplina') ? 'border-red-500 ring-1 ring-red-500' : 'border-[#e1e8f0]'}`} required autoComplete="off" />
                  {tooltipField === 'disciplina' && <ValidationTooltip message="Completa este campo" />}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#111] mb-2 uppercase tracking-wide">Fecha *</label>
                <div className="relative">
                  <input id="input-fecha" name="fecha" value={formData.fecha} onChange={handleChange1} type="date" className={`w-full p-2.5 text-sm border rounded bg-white cursor-pointer ${formErrors.includes('fecha') ? 'border-red-500 ring-1 ring-red-500' : 'border-[#e1e8f0]'}`} required />
                  {tooltipField === 'fecha' && <ValidationTooltip message="Completa este campo" />}
                </div>
              </div>
            </div>

            <hr className="my-8 border-[#e1e8f0]" />

            {/* ZONA DE CARGA DE LOGO DE EVENTO HIBRIDA */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 sm:grid-cols-2 gap-6">

              {/* Logo 1 */}
              <div className="bg-[#f8f9fa] p-4 rounded border border-[#eee]">
                <label className="block text-sm font-bold text-[#111] mb-2 uppercase tracking-wide">Logo Principal *</label>
                <div className="grid grid-cols-3 mb-3 border-b border-[#e1e8f0]">
                  <button type="button" onClick={() => { setLogoMode('url'); if (formErrors.includes('logo')) setFormErrors(prev => prev.filter(f => f !== 'logo')); }} className={`py-2 text-[9px] sm:text-[11px] font-bold cursor-pointer transition-colors outline-none ${logoMode === 'url' ? 'border-b-2 border-[#b91d22] text-[#111]' : 'text-gray-400 hover:text-gray-600'}`}>PEGAR URL</button>
                  <button type="button" onClick={() => { setLogoMode('file'); if (formErrors.includes('logo')) setFormErrors(prev => prev.filter(f => f !== 'logo')); }} className={`py-2 text-[9px] sm:text-[11px] font-bold cursor-pointer transition-colors outline-none ${logoMode === 'file' ? 'border-b-2 border-[#b91d22] text-[#111]' : 'text-gray-400 hover:text-gray-600'}`}>ARCHIVO</button>
                  <button type="button" onClick={() => { setLogoMode('cramm'); setFormErrors(prev => prev.filter(f => f !== 'logo')); }} className={`py-2 text-[9px] sm:text-[11px] font-bold cursor-pointer transition-colors outline-none ${logoMode === 'cramm' ? 'border-b-2 border-[#b91d22] text-[#b91d22]' : 'text-gray-400 hover:text-[#b91d22]'}`}>LOGO CRAMM</button>
                </div>

                {logoMode === 'url' && (
                  <div className="relative">
                    <input id="input-logo-url" type="text" value={logoUrlInput} onChange={(e) => { setLogoUrlInput(e.target.value); if (formErrors.includes('logo')) setFormErrors(prev => prev.filter(f => f !== 'logo')); }} placeholder="Ingresa la URL del logo (.png, .jpg)" className={`w-full p-2.5 text-xs border rounded bg-white ${formErrors.includes('logo') ? 'border-red-500 ring-1 ring-red-500' : 'border-[#e1e8f0]'}`} />
                    {tooltipField === 'logo' && <ValidationTooltip message="Completa este campo" />}
                  </div>
                )}
                {logoMode === 'file' && (
                  <div className="w-full relative">
                    <label htmlFor="logo-upload" className={`flex items-center justify-center gap-2 w-full p-2.5 text-[10px] font-bold border rounded bg-white hover:bg-red-50 cursor-pointer transition-all uppercase tracking-tight ${formErrors.includes('logo') ? 'border-red-500 ring-1 ring-red-500 text-red-500' : 'text-[#b91d22] border-[#b91d22]'}`}>
                      <span className="material-symbols-outlined text-sm">cloud_upload</span>
                      Seleccionar Archivo
                    </label>
                    {tooltipField === 'logo' && <ValidationTooltip message="Completa este campo" />}
                    <input id="logo-upload" type="file" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files.length > 0) { setLogoFile(e.target.files[0]); if (formErrors.includes('logo')) setFormErrors(prev => prev.filter(f => f !== 'logo')); } }} className="hidden" />
                    <div className="mt-1 px-1 text-[9px] text-gray-500 truncate">
                      {logoFile ? `📄 ${logoFile.name}` : 'Ningún archivo seleccionado'}
                    </div>
                  </div>
                )}

                {(logoMode === 'cramm' || (logoMode === 'url' && logoUrlInput) || (logoMode === 'file' && logoFile)) && (
                  <div className="mt-3 w-full h-[150px] border border-[#e1e8f0] rounded-md flex justify-center items-center overflow-hidden bg-white shadow-sm p-2">
                    <img src={logoMode === 'cramm' ? '/logo_cramm.png' : (logoMode === 'url' ? logoUrlInput : URL.createObjectURL(logoFile))} alt="Logo Preview" className="max-w-full max-h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}
              </div>

              {/* Logo 2 */}
              <div className="bg-[#f8f9fa] p-4 rounded border border-[#eee]">
                <label className="block text-sm font-bold text-[#111] mb-2 uppercase tracking-wide text-gray-500">Logo Secundario (Opcional)</label>
                <div className="grid grid-cols-2 mb-3 border-b border-[#e1e8f0]">
                  <button type="button" onClick={() => setLogo2Mode('url')} className={`py-2 text-[9px] sm:text-[11px] font-bold cursor-pointer transition-colors outline-none ${logo2Mode === 'url' ? 'border-b-2 border-[#b91d22] text-[#111]' : 'text-gray-400 hover:text-gray-600'}`}>PEGAR URL</button>
                  <button type="button" onClick={() => setLogo2Mode('file')} className={`py-2 text-[9px] sm:text-[11px] font-bold cursor-pointer transition-colors outline-none ${logo2Mode === 'file' ? 'border-b-2 border-[#b91d22] text-[#111]' : 'text-gray-400 hover:text-gray-600'}`}>ARCHIVO</button>
                </div>

                {logo2Mode === 'url' && (
                  <input type="text" value={logo2UrlInput} onChange={(e) => setLogo2UrlInput(e.target.value)} placeholder="URL opcional..." className="w-full p-2.5 text-xs border border-[#e1e8f0] rounded bg-white" />
                )}
                {logo2Mode === 'file' && (
                  <div className="w-full">
                    <label htmlFor="logo2-upload" className="flex items-center justify-center gap-2 w-full p-2.5 text-[10px] font-bold border border-[#b91d22] text-[#b91d22] rounded bg-white hover:bg-red-50 cursor-pointer transition-all uppercase tracking-tight">
                      <span className="material-symbols-outlined text-sm">cloud_upload</span>
                      Seleccionar Archivo
                    </label>
                    <input id="logo2-upload" type="file" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files.length > 0) setLogo2File(e.target.files[0]) }} className="hidden" />
                    <div className="mt-1 px-1 text-[9px] text-gray-500 truncate">
                      {logo2File ? `📄 ${logo2File.name}` : 'Ningún archivo seleccionado'}
                    </div>
                  </div>
                )}

                {((logo2Mode === 'url' && logo2UrlInput) || (logo2Mode === 'file' && logo2File)) && (
                  <div className="mt-3 w-full h-[150px] border border-[#e1e8f0] rounded-md flex justify-center items-center overflow-hidden bg-white shadow-sm p-2">
                    <img src={logo2Mode === 'url' ? logo2UrlInput : URL.createObjectURL(logo2File)} alt="Logo Preview" className="max-w-full max-h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}
              </div>

              {/* Marca de Agua */}
              <div className="bg-[#f8f9fa] p-4 rounded border border-[#eee]">
                <label className="block text-sm font-bold text-[#111] mb-2 uppercase tracking-wide text-gray-500">Marca de Agua (Centro)</label>
                <div className="grid grid-cols-3 mb-3 border-b border-[#e1e8f0]">
                  <button type="button" onClick={() => setWatermarkMode('url')} className={`py-2 text-[9px] sm:text-[11px] font-bold cursor-pointer transition-colors outline-none ${watermarkMode === 'url' ? 'border-b-2 border-[#b91d22] text-[#111]' : 'text-gray-400 hover:text-gray-600'}`}>PEGAR URL</button>
                  <button type="button" onClick={() => setWatermarkMode('file')} className={`py-2 text-[9px] sm:text-[11px] font-bold cursor-pointer transition-colors outline-none ${watermarkMode === 'file' ? 'border-b-2 border-[#b91d22] text-[#111]' : 'text-gray-400 hover:text-gray-600'}`}>ARCHIVO</button>
                  <button type="button" onClick={() => setWatermarkMode('cramm')} className={`py-2 text-[9px] sm:text-[11px] font-bold cursor-pointer transition-colors outline-none ${watermarkMode === 'cramm' ? 'border-b-2 border-[#b91d22] text-[#b91d22]' : 'text-gray-400 hover:text-[#b91d22]'}`}>MARCA CRAMM</button>
                </div>

                {watermarkMode === 'url' && (
                  <input type="text" value={watermarkUrlInput} onChange={(e) => setWatermarkUrlInput(e.target.value)} placeholder="URL opcional..." className="w-full p-2.5 text-xs border border-[#e1e8f0] rounded bg-white" />
                )}
                {watermarkMode === 'file' && (
                  <div className="w-full">
                    <label htmlFor="watermark-upload" className="flex items-center justify-center gap-2 w-full p-2.5 text-[10px] font-bold border border-[#b91d22] text-[#b91d22] rounded bg-white hover:bg-red-50 cursor-pointer transition-all uppercase tracking-tight">
                      <span className="material-symbols-outlined text-sm">cloud_upload</span>
                      Seleccionar Archivo
                    </label>
                    <input id="watermark-upload" type="file" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files.length > 0) setWatermarkFile(e.target.files[0]) }} className="hidden" />
                    <div className="mt-1 px-1 text-[9px] text-gray-500 truncate">
                      {watermarkFile ? `📄 ${watermarkFile.name}` : 'Ningún archivo seleccionado'}
                    </div>
                  </div>
                )}

                {(watermarkMode === 'cramm' || (watermarkMode === 'url' && watermarkUrlInput) || (watermarkMode === 'file' && watermarkFile)) && (
                  <div className="mt-3 w-full h-[150px] border border-[#e1e8f0] rounded-md flex justify-center items-center overflow-hidden bg-white shadow-sm p-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZWVlIj48L3JlY3Q+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlZWUiPjwvcmVjdD4KPC9zdmc+')]">
                    <img src={watermarkMode === 'cramm' ? '/logo_cramm.png' : (watermarkMode === 'url' ? watermarkUrlInput : URL.createObjectURL(watermarkFile))} alt="Watermark Preview" className="max-w-full max-h-full object-contain mix-blend-multiply" onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}
              </div>

            </div>

            <hr className="my-8 border-[#e1e8f0]" />

            {/* ZONA DE CATEGORIAS DE PELEA (NUEVA ARQUITECTURA DINAMICA) */}
            <div className="mb-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-[#b91d22] m-0 flex items-center gap-2">
                  <span className="bg-[#b91d22] text-white w-6 h-6 rounded-full flex justify-center items-center text-[12px] shadow-sm"><span className="material-symbols-outlined text-[14px]">sports_mma</span></span>
                  Estructura y Tipos de Peleas
                </h3>
                <p className="text-xs text-gray-500 mt-1">Crea bloques de combates. Escribe el Tipo (ej. <i>Amateur 60kg</i>, <i>Profesional</i>) e ingresa cuántas peleas son.</p>
              </div>

              <div className="space-y-3 bg-[#f8f9fa] p-4 rounded-md border border-[#eee]">
                {categorias.map((cat, idx) => (
                  <div key={cat.id} className="flex grid grid-cols-[1fr_80px_auto] items-center gap-3 relative">
                    <input id={idx === 0 ? 'input-cat-tipo-0' : undefined} type="text" placeholder="Categoría (Ej. PRELIMINAR)" value={cat.tipo} onChange={(e) => updateCategoria(idx, 'tipo', e.target.value)} className={`w-full p-2.5 text-sm border rounded focus:border-[#888] outline-none uppercase ${formErrors.includes('categories') ? 'border-red-500 ring-1 ring-red-500' : 'border-[#ccc]'}`} required />
                    {tooltipField === 'categories' && idx === 0 && <ValidationTooltip message="Completa este campo" />}
                    <input id={idx === 0 ? 'input-cat-cant-0' : undefined} type="number" placeholder="Cant." min="1" max="40" value={cat.cant} onChange={(e) => updateCategoria(idx, 'cant', e.target.value)} className={`w-full p-2.5 text-sm border rounded text-center focus:border-[#888] outline-none ${formErrors.includes('categories') ? 'border-red-500 ring-1 ring-red-500' : 'border-[#ccc]'}`} required title="Cantidad de peleas de este tipo" />

                    {/* Botón borrar fila solo si hay más de 1 categoría */}
                    {categorias.length > 1 ? (
                      <button type="button" onClick={() => removeCategoria(idx)} className="w-[38px] h-[38px] text-red-500 border border-red-200 hover:bg-red-50 rounded bg-white flex justify-center items-center" title="Quitar Categoría"><span className="material-symbols-outlined text-xl">close</span></button>
                    ) : (
                      <div className="w-[38px]"></div> // Spacer visual 
                    )}
                  </div>
                ))}

                <button type="button" onClick={agregarCategoria} className="mt-2 text-sm text-[#3a475a] font-bold hover:underline flex items-center gap-1 pt-2">
                  + Añadir otro Nuevo Tipo de Pelea
                </button>
              </div>
            </div>

            <div className="mt-10 text-center">
              <button type="submit" className="w-[250px] bg-[#3a475a] hover:bg-[#2a3442] text-white border-none py-3.5 px-6 text-sm font-semibold rounded-md cursor-pointer tracking-wide transition-colors shadow-sm">
                INICIAR REGISTRO
              </button>
            </div>
          </form>
        )}

        {/* MÚLTIPLES PASOS DINÁMICOS DE PELEADORES PREDIBUJADOS */}
        {!isSuccess && currentStep > 1 && currentStep <= fightFormsData.length + 1 && renderPeleasPaso()}

        {/* PASO EXCLUSIVO: RESUMEN GENERAL PRE-GUARDADO */}
        {!isSuccess && currentStep === fightFormsData.length + 2 && renderResumenFinal()}

      </div>

      {/* CUSTOM ALERT / CONFIRM MODAL */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[2px] px-4 animate-in fade-in duration-200">
          <div className="bg-[#2a2a2a] border border-[#444] rounded-[24px] shadow-2xl w-full max-w-[420px] overflow-hidden py-1">
            <div className="px-7 pt-6 pb-5">
              <h3 className="text-white font-bold text-lg mb-4 leading-none">
                localhost:5173 dice
              </h3>
              <p className="text-[#ddd] text-[15px] leading-relaxed mb-8">
                {confirmDialog.message}
              </p>
            </div>
            <div className="px-7 pb-6 flex justify-end gap-3 align-center">
              {confirmDialog.isAlert ? (
                <button
                  onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null, isAlert: false })}
                  className="px-6 py-2.5 bg-[#b91d22] hover:bg-[#a0181d] text-white rounded-full font-bold text-[15px] transition-colors shadow-sm"
                >
                  Aceptar
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                      setConfirmDialog({ isOpen: false, message: '', onConfirm: null, isAlert: false });
                    }}
                    className="px-6 py-2.5 bg-[#c2d6ff] hover:bg-[#a3bffc] text-[#0f346e] border border-[#7f9cf0] ring-2 ring-white/10 rounded-full font-bold text-[15px] transition-colors shadow-sm"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null, isAlert: false })}
                    className="px-6 py-2.5 bg-[#004f8f] hover:bg-[#003d73] text-white rounded-full font-bold text-[15px] transition-colors shadow-sm"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
