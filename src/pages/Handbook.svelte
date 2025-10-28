<script>
  import { Block } from "konsta/svelte";

  import { i18nStores } from "@/services/i18n";
  const { i18n } = i18nStores;

  import { resolvePageKeyFromRouteResult } from "@/utils/routerUtils";
  import { setNavbar } from "@/store/ui/navbar";

  // router props
  let { route } = $props();

  // Inspector check console in browser
  // $inspect(route);

  $effect(() => {
    const result = route?.result;

    // get "pageKey" from route path
    //    "/"      -> "home"
    //    "/about" -> "about"
    //    "/handbook" -> "handbook"
    const pageKey = resolvePageKeyFromRouteResult(result);

    /* prettier-ignore */
    const translatedTitle = pageKey
      ? $i18n.t(`ui:navbar:${pageKey}:title`)
      : "";

    // Tell the global navbar:
    // - which title to show
    // - whether to show search
    // - whether to show favrites
    setNavbar({
      title: translatedTitle || pageKey,
    });
  });
</script>

<Block>
  <h1>Handbook</h1>
  <p>
    Lorem ipsum dolor sit amet consectetur adipisicing elit. Soluta inventore facilis quo magni molestiae incidunt
    tempore ipsam expedita. Quibusdam temporibus, commodi nostrum reprehenderit quasi vel iusto adipisci exercitationem
    tempore architecto consectetur saepe harum aspernatur pariatur fuga officiis aperiam ullam! Molestias quidem
    distinctio repudiandae animi! Omnis minus saepe, quis nostrum ratione vero ea dolore odio, eaque maxime laborum
    inventore voluptate earum nobis? Laudantium doloremque accusantium eligendi alias, officiis natus consequatur sunt
    hic corporis magni minus nihil ratione temporibus numquam quis non dolorem at delectus assumenda tempora nostrum
    dolore quas beatae dolorum. Officiis tempora sapiente id quia quae? Sunt laudantium quasi totam nostrum voluptate
    nihil, perferendis praesentium, minima placeat qui repellat accusantium, harum rerum deserunt impedit? Numquam,
    nihil! Necessitatibus quisquam, non nesciunt quod explicabo illum aperiam quis possimus vero porro sint numquam,
    sequi perspiciatis recusandae nostrum quidem debitis culpa error repellat aut ab? Ex vero eaque, odio obcaecati
    suscipit quidem saepe repellendus earum. Quas vero consectetur nesciunt cumque quaerat magni ratione perferendis,
    labore veritatis ducimus! Tenetur vel blanditiis autem magni, ratione id, adipisci aliquam fuga quia amet tempore
    nihil a temporibus doloribus magnam? Eos non, expedita possimus ab ullam laborum fugit numquam. Ut placeat
    reiciendis maiores autem adipisci, eligendi eos quo, debitis ex explicabo sit doloremque harum? Quod esse, vitae
    veniam maxime consectetur, eveniet quisquam quibusdam dolores ipsam laborum hic ea ad laboriosam totam officiis et a
    consequatur quia dignissimos odit dolore ullam. Sit laudantium doloribus ea exercitationem quisquam tempore vel
    velit, optio itaque odit error praesentium, commodi excepturi voluptates cupiditate, deserunt voluptate dolorem
    quidem minima. Dolorum unde minima suscipit impedit illo minus modi eius excepturi alias molestiae illum, rem soluta
    nostrum saepe aperiam quasi, dolore tempora fugiat sapiente qui nobis? Rerum omnis ratione laboriosam sapiente
    soluta iste nostrum cumque optio voluptatibus facere? At aut modi doloremque, omnis laudantium cum? Molestias,
    perferendis.
  </p>
</Block>
