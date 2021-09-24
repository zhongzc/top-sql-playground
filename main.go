package main

import (
	"flag"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/breeswish/top-sql-playground/uiserver"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/zap"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

var (
	uiAPIListen = flag.String("ui-listen", "127.0.0.1:14000", "The UI API service listen host and port")
)

func startHttpServer(l net.Listener) error {
	r := gin.New()

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	r.Use(cors.New(config))
	r.Use(gzip.Gzip(gzip.DefaultCompression))
	r.Use(ginzap.Ginzap(zap.L(), time.RFC3339, true))
	r.Use(ginzap.RecoveryWithZap(zap.L(), true))

	mux := http.DefaultServeMux
	mux.Handle("/", uiserver.Handler())
	srv := &http.Server{Handler: mux}
	return srv.Serve(l)
}

func main() {
	logger, _ := zap.NewDevelopment()
	zap.ReplaceGlobals(logger)

	flag.Parse()

	apiL, err := net.Listen("tcp", *uiAPIListen)
	if err != nil {
		log.Fatalf("API service failed to listen: %v", err)
	}
	zap.L().Info("API service listening", zap.String("address", *uiAPIListen))
	startHttpServer(apiL)
}
